import * as Astronomy from 'astronomy-engine';
import { objects } from '../catalog';
import type { ObjId } from '../catalog';
import type { MarkerItem } from '../wheel/types';

import type { WheelInput, CompassSolveResult, CycleSpoke } from '../board/runtime';
import { resolveWheel } from '../board/dispatcher';
import { resolveWheelMeta } from '../board/registry';
import { AU_KM, clamp, norm360 } from './helpers';
import { solveSynodWheel, synodInstantAt, synodPhaseToWheelAngleDeg, type SynodMeta } from './synod';
import { solveBindWheel } from './bind';
import type { BindMeta } from './bind';
import { solveNodalWheel } from './nodal';
import type { NodalMeta } from './nodal';
import type { CompassTrackPoint } from './compass';
import { eqToEcl } from './vector';
import { system as systemSpec } from '../catalog/wheels/system';

const SYSTEM_TRACK_DENSIFY_ANGLE_GAP_DEG = 20;

function uniqueTags(tags: Array<string | null | undefined>): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const raw of tags) {
        if (typeof raw !== 'string') continue;
        const tag = raw.trim();
        if (!tag) continue;
        if (seen.has(tag)) continue;
        seen.add(tag);
        out.push(tag);
    }
    return out;
}

function cleanSystemCycleTags(rawTags: unknown, code: string): string[] {
    const tags = Array.isArray(rawTags) ? rawTags : [];
    const isESpoke = code === 'E' || code === 'E_next' || code === 'E+';
    return uniqueTags(
        tags.filter((tag): tag is string => {
            if (typeof tag !== 'string') return false;
            if (!isESpoke) return true;
            if (tag === 'cycle start' || tag === 'cycle end') return false;
            if (tag.startsWith('cycle duration ')) return false;
            return true;
        })
    );
}

export type SystemTrackPoint = CompassTrackPoint & {
    phaseDeg: number;
    distanceAu: number;
    focusDistAu: number;
};

export type SystemTargetState = {
    id: ObjId;
    azimuthDeg: number;
    altitudeDeg: number;
    angleDeg: number;
    orbit: number;
    visible: boolean;
    orbitTrack?: SystemTrackPoint[];
    phaseDeg: number;
    distanceAu: number;
    focusDistAu: number;
    distanceLabel: string;
    infoMeta?: {
        synod?: Record<string, unknown>;
        bind?: Record<string, unknown>;
        nodal?: Record<string, unknown>;
    };
};

function bodyEmoji(id: ObjId): string {
    const b = (objects as any)[id] as { emoji?: string } | undefined;
    return b?.emoji ?? '•';
}

function bodyNameEn(id: ObjId): string {
    const b = (objects as any)[id] as { name?: { en?: string } } | undefined;
    return b?.name?.en ?? String(id);
}

function asTargetArray(v: unknown): ObjId[] {
    if (Array.isArray(v)) return v.filter(Boolean) as ObjId[];
    if (typeof v === 'string' && v) return [v as ObjId];
    return [];
}

function pseudoAzimuthFromWheelAngle(angleDeg: number): number {
    return norm360(angleDeg + 90);
}

function systemPhaseDeg(inst: { thetaModDeg: number }): number {
    return norm360(inst.thetaModDeg);
}

function systemAngleDeg(inst: { thetaModDeg: number }): number {
    return synodPhaseToWheelAngleDeg(systemPhaseDeg(inst));
}

function toEngineBody(id: ObjId): any {
    return (Astronomy as any).Body?.[id as any] ?? (Astronomy as any).Body?.Sun;
}

function helioVec(id: ObjId, ts: number): { x: number; y: number; z: number } | null {
    const A: any = Astronomy as any;
    const t = new A.AstroTime(new Date(ts));

    if (id === 'Sun') return { x: 0, y: 0, z: 0 };

    try {
        if (typeof A.HelioVector === 'function') {
            const v = A.HelioVector(toEngineBody(id), t);
            if (v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z)) {
                return { x: v.x, y: v.y, z: v.z };
            }
        }
    } catch {}

    return null;
}

function eclipticLatitudeDegAt(focus: ObjId, target: ObjId, ts: number): number {
    // Keep Earth's heliocentric path exactly on the ecliptic baseline in system wheel.
    if (focus === 'Sun' && target === 'Earth') return 0;

    const pF = helioVec(focus, ts);
    const pT = helioVec(target, ts);
    if (!pF || !pT) return NaN;

    const vEq = { x: pT.x - pF.x, y: pT.y - pF.y, z: pT.z - pF.z };
    const vEcl = eqToEcl(vEq);
    const r = Math.hypot(vEcl.x, vEcl.y, vEcl.z);
    if (!(r > 0)) return NaN;
    return (Math.asin(vEcl.z / r) * 180) / Math.PI;
}

async function resolveSynodSpokesForTarget(
    input: WheelInput,
    looker: ObjId,
    focus: ObjId,
    target: ObjId
): Promise<CycleSpoke<SynodMeta>[] | undefined> {
    const virtualSynodWheel = {
        wheelType: 'synod' as const,
        roles: { looker, focus, target }
    };

    const cached = await resolveWheel(virtualSynodWheel as any, {
        ts: input.ts,
        location: input.location,
        dbg: input.dbg
    });
    if (cached && cached.kind === 'cycle' && cached.ok) {
        const xs = cached.spokes as CycleSpoke<SynodMeta>[];
        const hasExactTs = xs.every((s) => Number.isFinite(Number((s as any)?.meta?.exactTs)));
        if (hasExactTs) return xs;

        // Legacy cached synod rows may miss meta.exactTs.
        // Recompute directly and prefer fresh spokes with exact timestamps.
        const fresh = solveSynodWheel({
            wheelType: 'synod',
            ts: input.ts,
            location: input.location,
            dbg: input.dbg,
            looker,
            focus,
            target
        } as WheelInput<'synod'>);
        if (fresh.ok) return fresh.spokes as CycleSpoke<SynodMeta>[];
        return xs;
    }

    const direct = solveSynodWheel({
        wheelType: 'synod',
        ts: input.ts,
        location: input.location,
        dbg: input.dbg,
        looker,
        focus,
        target
    } as WheelInput<'synod'>);
    if (!direct.ok) return undefined;
    return direct.spokes as CycleSpoke<SynodMeta>[];
}

async function resolveBindSpokesForTarget(
    input: WheelInput,
    focus: ObjId,
    target: ObjId,
    ts: number
): Promise<CycleSpoke<BindMeta>[] | undefined> {
    const virtualBindWheel = {
        id: `virtual:bind:${String(focus)}:${String(target)}`,
        wheelType: 'bind' as const,
        roles: { focus, target }
    };

    const res = await resolveWheel(virtualBindWheel as any, {
        ts,
        location: input.location,
        dbg: input.dbg
    });
    if (res && res.kind === 'cycle' && res.ok) {
        return res.spokes as CycleSpoke<BindMeta>[];
    }

    const meta = resolveWheelMeta({
        wheelType: 'bind',
        roles: { focus, target }
    } as any);

    const direct = solveBindWheel({
        wheelType: 'bind',
        ts,
        location: input.location,
        dbg: input.dbg,
        focus,
        target,
        meta
    } as WheelInput<'bind'>);
    if (!direct.ok) return undefined;
    return direct.spokes as CycleSpoke<BindMeta>[];
}

async function resolveNodalSpokesForTarget(
    input: WheelInput,
    target: ObjId,
    ts: number
): Promise<CycleSpoke<NodalMeta>[] | undefined> {
    const nodalLooker = 'Earth' as ObjId;
    const nodalFocus = 'Sun' as ObjId;

    const virtualNodalWheel = {
        id: `virtual:nodal:${String(nodalLooker)}:${String(nodalFocus)}:${String(target)}`,
        wheelType: 'nodal' as const,
        roles: { looker: nodalLooker, focus: nodalFocus, target }
    };

    const res = await resolveWheel(virtualNodalWheel as any, {
        ts,
        location: input.location,
        dbg: input.dbg
    });
    if (res && res.kind === 'cycle' && res.ok) {
        return res.spokes as CycleSpoke<NodalMeta>[];
    }

    const direct = solveNodalWheel({
        wheelType: 'nodal',
        ts,
        location: input.location,
        dbg: input.dbg,
        looker: nodalLooker,
        focus: nodalFocus,
        target
    } as WheelInput<'nodal'>);
    if (!direct.ok) return undefined;
    return direct.spokes as CycleSpoke<NodalMeta>[];
}

async function collectBindSpokesInWindow(
    input: WheelInput,
    focus: ObjId,
    target: ObjId,
    startTs: number,
    endTs: number
): Promise<CycleSpoke<BindMeta>[]> {
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs) || endTs <= startTs) return [];

    const out: CycleSpoke<BindMeta>[] = [];
    const seenCycles = new Set<string>();
    const seenSpokes = new Set<string>();
    const RANGE_EPS_MS = 60_000;

    const CYCLE_SHIFT_EPS_MS = 1_500;
    const MAX_CYCLES = 160;
    let probe = startTs + CYCLE_SHIFT_EPS_MS;

    for (let i = 0; i < MAX_CYCLES; i++) {
        const spokes = await resolveBindSpokesForTarget(input, focus, target, probe);
        if (!spokes?.length) break;

        const sorted = spokes.slice().sort((a, b) => a.index - b.index);
        const s0 = sorted.find((s) => s.index === 0);
        const s16 = sorted.find((s) => s.index === 16);
        if (!s0 || !s16 || !(s16.ts > s0.ts)) break;

        const cycleKey = `${Math.round(s0.ts)}:${Math.round(s16.ts)}`;
        if (seenCycles.has(cycleKey)) break;
        seenCycles.add(cycleKey);

        for (const s of sorted) {
            if (s.ts < (startTs - RANGE_EPS_MS) || s.ts > (endTs + RANGE_EPS_MS)) continue;
            const key = `${s.index}:${Math.round(s.ts)}`;
            if (seenSpokes.has(key)) continue;
            seenSpokes.add(key);
            out.push(s);
        }

        if (s16.ts >= endTs) break;

        const nextProbe = s16.ts + CYCLE_SHIFT_EPS_MS;
        if (!(nextProbe > probe)) break;
        probe = nextProbe;
    }

    return out.sort((a, b) => a.ts - b.ts);
}

function buildTrackFromSynodSpokes(
    spokes: CycleSpoke<SynodMeta>[] | undefined,
    looker: ObjId,
    focus: ObjId,
    target: ObjId
): SystemTrackPoint[] | undefined {
    if (!spokes?.length) return undefined;

    const out: SystemTrackPoint[] = [];
    for (const s of spokes) {
        const exactTsRaw = Number(s.meta?.exactTs);
        const nodeTs = Number.isFinite(exactTsRaw) ? exactTsRaw : s.ts;
        const inst = synodInstantAt(looker, focus, target, nodeTs);
        if (!inst) continue;
        const eclLat = eclipticLatitudeDegAt(focus, target, nodeTs);
        // Keep spoke nodes exactly on spoke angles even if cached ts is minute-rounded.
        const spokePhaseDeg = 90 + (360 * (s.index ?? 0)) / 16;
        const spokeAngleDeg = synodPhaseToWheelAngleDeg(spokePhaseDeg);
        const spokePhaseNormDeg = norm360(spokePhaseDeg);
        const tags = uniqueTags(Array.isArray(s.tags) ? s.tags : []);
        out.push({
            ts: nodeTs,
            index: s.index,
            code: s.code,
            azimuthDeg: pseudoAzimuthFromWheelAngle(spokeAngleDeg),
            altitudeDeg: eclLat,
            angleDeg: spokeAngleDeg,
            orbit: NaN,
            visible: Number.isFinite(eclLat) ? eclLat >= 0 : true,
            source: 'spoke',
            sourceWheel: 'synod',
            phaseDeg: spokePhaseNormDeg,
            distanceAu: inst.distanceAu,
            focusDistAu: inst.focusDistAu,
            tags: tags.length ? tags : undefined,
            meta: {
                ...(s.meta && typeof s.meta === 'object' ? (s.meta as Record<string, unknown>) : {}),
                phaseDeg: spokePhaseNormDeg,
                eclipticLatDeg: eclLat,
                distanceAu: inst.distanceAu,
                distanceKm: inst.distanceAu * AU_KM,
                focusDistAu: inst.focusDistAu
            }
        });
    }
    return out.sort((a, b) => a.ts - b.ts);
}

function unwrapTrackAnglesByTs(points: SystemTrackPoint[]): Array<SystemTrackPoint & { angleUnwrapped: number }> {
    const sorted = points.slice().sort((a, b) => a.ts - b.ts);
    const out: Array<SystemTrackPoint & { angleUnwrapped: number }> = [];
    for (const p of sorted) {
        if (!out.length) {
            out.push({ ...p, angleUnwrapped: p.angleDeg });
            continue;
        }
        let a = p.angleDeg;
        const prev = out[out.length - 1].angleUnwrapped;
        while (a - prev > 180) a -= 360;
        while (a - prev < -180) a += 360;
        out.push({ ...p, angleUnwrapped: a });
    }
    return out;
}

function solveTsForTargetUnwrappedAngle(opts: {
    looker: ObjId;
    focus: ObjId;
    target: ObjId;
    t0: number;
    t1: number;
    targetUnwrapped: number;
}): number | null {
    const { looker, focus, target, t0, t1, targetUnwrapped } = opts;
    if (!(Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0)) return null;

    const diffAtTs = (ts: number): number | null => {
        const inst = synodInstantAt(looker, focus, target, ts);
        if (!inst) return null;
        const a = systemAngleDeg(inst);
        const branch = Math.round((targetUnwrapped - a) / 360);
        return (a + 360 * branch) - targetUnwrapped;
    };

    const d0 = diffAtTs(t0);
    const d1 = diffAtTs(t1);
    if (d0 == null || d1 == null) return null;

    // If bracket is weak, use linear interpolation over endpoint unwrapped angles.
    if (d0 === 0) return t0;
    if (d1 === 0) return t1;
    if (d0 * d1 > 0) return null;

    let lo = t0;
    let hi = t1;
    let dlo = d0;
    let dhi = d1;
    const MAX_ITERS = 22;
    const ROOT_EPS = 0.02;

    for (let i = 0; i < MAX_ITERS; i++) {
        const mid = (lo + hi) * 0.5;
        const dm = diffAtTs(mid);
        if (dm == null) return null;
        if (Math.abs(dm) <= ROOT_EPS) return mid;
        if (dlo * dm <= 0) {
            hi = mid;
            dhi = dm;
        } else {
            lo = mid;
            dlo = dm;
        }
        if (Math.abs(hi - lo) <= 250) return (lo + hi) * 0.5;
    }

    return (lo + hi) * 0.5;
}

function densifyTrackByAngleGap(
    points: SystemTrackPoint[] | undefined,
    looker: ObjId,
    focus: ObjId,
    target: ObjId
): SystemTrackPoint[] | undefined {
    if (!points || points.length < 2) return points;

    const unwrapped = unwrapTrackAnglesByTs(points);
    const out: SystemTrackPoint[] = [];

    for (let i = 0; i < unwrapped.length - 1; i++) {
        const a = unwrapped[i];
        const b = unwrapped[i + 1];
        out.push({
            ...a,
            angleDeg: a.angleDeg
        });

        const delta = b.angleUnwrapped - a.angleUnwrapped;
        const gap = Math.abs(delta);
        if (!(gap > SYSTEM_TRACK_DENSIFY_ANGLE_GAP_DEG) || !(b.ts > a.ts)) continue;

        const slices = Math.ceil(gap / SYSTEM_TRACK_DENSIFY_ANGLE_GAP_DEG);
        for (let s = 1; s < slices; s++) {
            const u = s / slices;
            const targetUnwrapped = a.angleUnwrapped + delta * u;

            let tMid = solveTsForTargetUnwrappedAngle({
                looker,
                focus,
                target,
                t0: a.ts,
                t1: b.ts,
                targetUnwrapped
            });

            const tsMid = Number.isFinite(tMid) ? (tMid as number) : (a.ts + (b.ts - a.ts) * u);

            const inst = synodInstantAt(looker, focus, target, tsMid);
            if (!inst) continue;
            const eclLat = eclipticLatitudeDegAt(focus, target, tsMid);

            out.push({
                ts: tsMid,
                index: a.index,
                code: a.code,
                azimuthDeg: pseudoAzimuthFromWheelAngle(systemAngleDeg(inst)),
                altitudeDeg: eclLat,
                angleDeg: systemAngleDeg(inst),
                orbit: NaN,
                visible: Number.isFinite(eclLat) ? eclLat >= 0 : true,
                source: 'cycle',
                sourceWheel: 'synod',
                phaseDeg: systemPhaseDeg(inst),
                distanceAu: inst.distanceAu,
                focusDistAu: inst.focusDistAu,
                meta: {
                    phaseDeg: systemPhaseDeg(inst),
                    eclipticLatDeg: eclLat,
                    distanceAu: inst.distanceAu,
                    distanceKm: inst.distanceAu * AU_KM,
                    focusDistAu: inst.focusDistAu
                }
            });
        }
    }

    const last = unwrapped[unwrapped.length - 1];
    out.push({ ...last, angleDeg: last.angleDeg });
    return out.sort((x, y) => x.ts - y.ts);
}

function buildTrackFromBindSpokes(
    spokes: CycleSpoke<BindMeta>[] | undefined,
    looker: ObjId,
    focus: ObjId,
    target: ObjId
): SystemTrackPoint[] | undefined {
    if (!spokes?.length) return undefined;

    const out: SystemTrackPoint[] = [];
    for (const s of spokes) {
        const inst = synodInstantAt(looker, focus, target, s.ts);
        if (!inst) continue;
        const dist = Number(s.meta?.distanceAu);
        const distanceAu = Number.isFinite(dist) && dist > 0 ? dist : inst.distanceAu;
        const eclLat = eclipticLatitudeDegAt(focus, target, s.ts);
        const tags = cleanSystemCycleTags(s.tags, s.code);

        out.push({
            ts: s.ts,
            index: s.index,
            code: s.code,
            azimuthDeg: pseudoAzimuthFromWheelAngle(systemAngleDeg(inst)),
            altitudeDeg: eclLat,
            angleDeg: systemAngleDeg(inst),
            orbit: NaN,
            visible: Number.isFinite(eclLat) ? eclLat >= 0 : true,
            source: 'cycle',
            sourceWheel: 'bind',
            phaseDeg: systemPhaseDeg(inst),
            distanceAu,
            focusDistAu: inst.focusDistAu,
            tags: tags.length ? tags : undefined,
            meta: {
                ...(s.meta && typeof s.meta === 'object' ? (s.meta as Record<string, unknown>) : {}),
                phaseDeg: systemPhaseDeg(inst),
                eclipticLatDeg: eclLat,
                distanceAu,
                distanceKm: distanceAu * AU_KM,
                focusDistAu: inst.focusDistAu
            }
        });
    }
    return out.sort((a, b) => a.ts - b.ts);
}

function buildTrackFromNodalSpokes(
    spokes: CycleSpoke<NodalMeta>[] | undefined,
    looker: ObjId,
    focus: ObjId,
    target: ObjId
): SystemTrackPoint[] | undefined {
    if (!spokes?.length) return undefined;

    const out: SystemTrackPoint[] = [];
    for (const s of spokes) {
        const inst = synodInstantAt(looker, focus, target, s.ts);
        if (!inst) continue;
        const eclLat = eclipticLatitudeDegAt(focus, target, s.ts);
        const tags = cleanSystemCycleTags(s.tags, s.code);
        const source =
            s.code === 'E' || s.code === 'W' || s.code === 'E_next'
                ? 'seam'
                : 'cycle';

        out.push({
            ts: s.ts,
            index: s.index,
            code: s.code,
            azimuthDeg: pseudoAzimuthFromWheelAngle(systemAngleDeg(inst)),
            altitudeDeg: Number.isFinite(eclLat) ? eclLat : Number(s.meta?.nodalLatitudeDeg),
            angleDeg: systemAngleDeg(inst),
            orbit: NaN,
            visible: Number.isFinite(eclLat) ? eclLat >= 0 : true,
            source,
            sourceWheel: 'nodal',
            phaseDeg: systemPhaseDeg(inst),
            distanceAu: inst.distanceAu,
            focusDistAu: inst.focusDistAu,
            tags: tags.length ? tags : undefined,
            meta: {
                ...(s.meta && typeof s.meta === 'object' ? (s.meta as Record<string, unknown>) : {}),
                phaseDeg: systemPhaseDeg(inst),
                eclipticLatDeg: eclLat,
                distanceAu: inst.distanceAu,
                distanceKm: inst.distanceAu * AU_KM,
                focusDistAu: inst.focusDistAu
            }
        });
    }
    return out.sort((a, b) => a.ts - b.ts);
}

function mergeTrackPointsPreferSynod(points: SystemTrackPoint[] | undefined): SystemTrackPoint[] | undefined {
    if (!points?.length) return points;

    const sorted = points
        .slice()
        .sort((a, b) => (a.ts - b.ts) || (a.angleDeg - b.angleDeg));

    const merged: SystemTrackPoint[] = [];
    const ANG_EPS = 1.2;
    const ORBIT_EPS = 0.02;
    const TS_EPS = 10 * 60_000;

    const angDist = (a: number, b: number) => {
        let d = Math.abs(a - b);
        while (d > 360) d -= 360;
        if (d > 180) d = 360 - d;
        return d;
    };

    const nodeGroups = (() => {
        const raw = (systemSpec as { nodes?: Record<string, string[]> }).nodes;
        const mainCycle = systemSpec.mainCycle;
        return {
            main: [`E-${mainCycle}`, `E_next-${mainCycle}`],
            nodal: Array.isArray(raw?.nodal)
                ? raw.nodal
                : (Array.isArray(raw?.seam) ? raw.seam : []),
            bind: Array.isArray(raw?.bind) ? raw.bind : [],
            synod: Array.isArray(raw?.synod) ? raw.synod : []
        };
    })();

    const hasAnyTag = (tags: string[], groupTags: string[]): boolean =>
        groupTags.some((tag) => tags.includes(tag));

    const pointGroup = (x: SystemTrackPoint): 'main' | 'nodal' | 'synod' | 'bind' | 'regular' => {
        const tags = Array.isArray(x.tags) ? x.tags.filter((t): t is string => typeof t === 'string') : [];
        if (hasAnyTag(tags, nodeGroups.main)) return 'main';
        if (hasAnyTag(tags, nodeGroups.nodal)) return 'nodal';
        if (hasAnyTag(tags, nodeGroups.bind)) return 'bind';
        if (hasAnyTag(tags, nodeGroups.synod)) return 'synod';
        return 'regular';
    };

    for (const p of sorted) {
        const pGroup = pointGroup(p);
        const hitIdx = merged.findIndex((m) =>
            pointGroup(m) === pGroup &&
            Math.abs(m.ts - p.ts) <= TS_EPS &&
            angDist(m.angleDeg, p.angleDeg) <= ANG_EPS &&
            Math.abs(m.distanceAu - p.distanceAu) <= ORBIT_EPS
        );

        if (hitIdx < 0) {
            merged.push(p);
            continue;
        }

        const prev = merged[hitIdx];
        const isBoundaryPoint = (x: SystemTrackPoint): boolean =>
            pointGroup(x) === 'main';
        const prevBoundary = isBoundaryPoint(prev);
        const pBoundary = isBoundaryPoint(p);

        const rank = (x: SystemTrackPoint) => {
            if (x.source === 'spoke') return 3;
            if (x.source === 'seam') return 2;
            return 1;
        };

        if (prevBoundary || pBoundary) {
            if (pBoundary && !prevBoundary) merged[hitIdx] = p;
            continue;
        }

        if (rank(p) > rank(prev)) {
            merged[hitIdx] = p;
        }
    }

    return merged.sort((a, b) => a.ts - b.ts);
}

function applySystemBoundaryCycleTags(track: SystemTrackPoint[] | undefined): SystemTrackPoint[] | undefined {
    if (!track?.length) return track;

    return track.map((p) => {
        const tags = uniqueTags(Array.isArray(p.tags) ? p.tags : []);
        if (tags.includes('E-synod')) {
            tags.push('cycle start');
        }
        if (tags.includes('E_next-synod')) {
            tags.push('cycle end');
        }
        const nextTags = uniqueTags(tags);
        return {
            ...p,
            tags: nextTags.length ? nextTags : undefined
        };
    });
}

function normalizeOrbit(distanceAu: number, maxAu: number): number {
    if (!(distanceAu > 0) || !Number.isFinite(distanceAu)) return 0;
    if (!(maxAu > 0) || !Number.isFinite(maxAu)) return 0;
    return clamp(distanceAu / maxAu, 0, 1);
}

export async function solveSystemWheel(input: WheelInput<'system'>): Promise<CompassSolveResult<SystemTargetState>> {
    const dbg = input.dbg;
    const ts = input.ts;

    const looker = input.looker as ObjId | undefined;
    const focus = input.focus as ObjId | undefined;
    const targets = asTargetArray(input.target);

    if (!looker || !focus) {
        const reason = 'System: looker and focus are required.';
        dbg?.warn?.('solveSystemWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }
    if (!targets.length) {
        const reason = 'System: target list is empty.';
        dbg?.warn?.('solveSystemWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    const raw = await Promise.all(targets.map(async (id): Promise<{
        id: ObjId;
        angleDeg: number;
        phaseDeg: number;
        distanceAu: number;
        focusDistAu: number;
        orbitTrack?: SystemTrackPoint[];
    } | null> => {
        const inst = synodInstantAt(looker, focus, id, ts);
        if (!inst) return null;

        const synodSpokes = await resolveSynodSpokesForTarget(input, looker, focus, id);
        const synodTrack = buildTrackFromSynodSpokes(synodSpokes, looker, focus, id);

        const synodStartRaw = synodSpokes?.[0]?.ts;
        const synodEndRaw = synodSpokes?.[16]?.ts;
        const hasSynodWindow =
            Number.isFinite(synodStartRaw) &&
            Number.isFinite(synodEndRaw) &&
            (synodEndRaw as number) > (synodStartRaw as number);
        const synodStart = hasSynodWindow ? (synodStartRaw as number) : NaN;
        const synodEnd = hasSynodWindow ? (synodEndRaw as number) : NaN;
        const bindSpokes = hasSynodWindow
            ? await collectBindSpokesInWindow(input, focus, id, synodStart, synodEnd)
            : [];
        const nodalSpokes = await resolveNodalSpokesForTarget(input, id, ts) ?? [];
        const bindTrack = buildTrackFromBindSpokes(bindSpokes, looker, focus, id);
        const nodalTrack = buildTrackFromNodalSpokes(nodalSpokes, looker, focus, id);

        const mergedTrack = mergeTrackPointsPreferSynod([...(bindTrack ?? []), ...(synodTrack ?? []), ...(nodalTrack ?? [])]);
        const denseTrack = densifyTrackByAngleGap(mergedTrack, looker, focus, id);
        const orbitTrackRaw = mergeTrackPointsPreferSynod(denseTrack);
        const orbitTrack = applySystemBoundaryCycleTags(orbitTrackRaw);

        return {
            id,
            angleDeg: systemAngleDeg(inst),
            phaseDeg: systemPhaseDeg(inst),
            distanceAu: inst.distanceAu,
            focusDistAu: inst.focusDistAu,
            orbitTrack
        };
    }));

    const rows = raw.filter((x): x is NonNullable<typeof x> => !!x);
    if (!rows.length) {
        const reason = 'System: no resolvable targets.';
        dbg?.warn?.('solveSystemWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    const distances = rows.flatMap((r) => {
        const vals = [r.distanceAu];
        if (r.orbitTrack?.length) vals.push(...r.orbitTrack.map((p) => p.distanceAu));
        return vals.filter((x) => Number.isFinite(x) && x > 0);
    });
    const maxAu = distances.length ? Math.max(...distances) : 1;

    const bodies: SystemTargetState[] = rows.map((r) => {
        const orbit = normalizeOrbit(r.distanceAu, maxAu);
        const eclLat = eclipticLatitudeDegAt(focus, r.id, ts);

        const orbitTrack = r.orbitTrack?.map((p) => {
            const o = normalizeOrbit(p.distanceAu, maxAu);
            return {
                ...p,
                orbit: o,
                visible: Number.isFinite(p.altitudeDeg) ? p.altitudeDeg >= 0 : true
            };
        });

        return {
            id: r.id,
            azimuthDeg: pseudoAzimuthFromWheelAngle(r.angleDeg),
            altitudeDeg: eclLat,
            angleDeg: r.angleDeg,
            orbit,
            visible: Number.isFinite(eclLat) ? eclLat >= 0 : true,
            orbitTrack,
            phaseDeg: r.phaseDeg,
            distanceAu: r.distanceAu,
            focusDistAu: r.focusDistAu,
            distanceLabel: `Dist to ${bodyNameEn(focus)}`,
            infoMeta: {
                synod: {
                    phaseDeg: r.phaseDeg,
                    distanceAu: r.distanceAu,
                    distanceKm: r.distanceAu * AU_KM,
                    focusDistAu: r.focusDistAu,
                    eclipticLatDeg: eclLat
                },
                bind: {
                    distanceAu: r.distanceAu,
                    distanceKm: r.distanceAu * AU_KM
                },
                nodal: {
                    nodalLatitudeDeg: eclLat,
                    distanceAu: r.distanceAu,
                    distanceKm: r.distanceAu * AU_KM,
                    planeDistanceAu: Number.isFinite(eclLat) ? (r.distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN,
                    planeDistanceKm: Number.isFinite(eclLat) ? (r.distanceAu * AU_KM * Math.sin((eclLat * Math.PI) / 180)) : NaN
                }
            }
        };
    });

    dbg?.log?.('solveSystemWheel.out', {
        ts,
        looker,
        focus,
        count: bodies.length,
        ids: bodies.map((b) => b.id)
    });

    return { ok: true, kind: 'compass', ts, bodies };
}

export function systemTargetsToMarkerItems(
    ts: number,
    targets: SystemTargetState[],
    focus: ObjId
): MarkerItem[] {
    const collectionId = `system:${String(focus)}`;

    return targets.map((t) => {
        const baseId = `body:${String(t.id)}`;
        const emoji = bodyEmoji(t.id);
        const name = bodyNameEn(t.id);

        return {
            id: `system:${String(focus)}:${String(t.id)}@${ts}`,
            baseId,
            collectionId,

            ts,
            angleDeg: t.angleDeg,
            orbit: t.orbit,

            bg: 'transparent',
            emoji,

            title: name,
            description: `Distance ${t.distanceAu.toFixed(5)} AU, phase ${t.phaseDeg.toFixed(1)}°`,
            opacity: 1
        };
    });
}
