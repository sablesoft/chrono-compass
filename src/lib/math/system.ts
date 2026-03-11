import * as Astronomy from 'astronomy-engine';
import { objects } from '../catalog';
import type { ObjId, ReferenceMeta } from '../catalog';
import { type MarkerItem, SPOKES_ORDER } from '../wheel/types';

import type { WheelInput, CompassSolveResult, CycleSpoke } from '../board/runtime';
import { resolveWheel } from '../board/dispatcher';
import { resolveWheelMeta } from '../board/registry';
import { AU_KM, clamp, currentHouseAtTs, norm360, trackInMainCycleWindow } from './helpers';
import { solveSynodWheel, synodInstantAt, synodPhaseToWheelAngleDeg, synodProjectedPhaseAt, type SynodMeta } from './synod';
import { solveBindWheel } from './bind';
import type { BindMeta } from './bind';
import { solveNodalWheel } from './nodal';
import type { NodalMeta } from './nodal';
import type { CompassTrackPoint } from './compass';
import { eqToEcl, refUnit } from './vector';
import { system as systemSpec } from '../catalog/wheels/system';

const SYSTEM_TRACK_DENSIFY_ANGLE_GAP_DEG = 20;
const SYSTEM_REFERENCE_RING_ORBIT = 1.5;

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
    planeDistanceAu: number;
    planeDistanceRatio: number;
};

export type SystemTargetState = {
    id: ObjId;
    kind: 'engine_body' | 'reference';
    azimuthDeg: number;
    altitudeDeg: number;
    angleDeg: number;
    orbit: number;
    visible: boolean;
    orbitTrack?: SystemTrackPoint[];
    phaseDeg: number;
    distanceAu: number;
    focusDistAu: number;
    planeDistanceAu: number;
    planeDistanceRatio: number;
    distanceLabel: string;
    currentHouses?: {
        synod?: string;
        bind?: string;
        nodal?: string;
    };
    infoMeta?: {
        synod?: Record<string, unknown>;
        bind?: Record<string, unknown>;
        nodal?: Record<string, unknown>;
    };
};

export type SystemSideProjection = {
    x: number;
    y: number;
    visible: boolean;
};

type Vec3d = { x: number; y: number; z: number };

function bodyEmoji(id: ObjId): string {
    const b = (objects as any)[id] as { emoji?: string } | undefined;
    return b?.emoji ?? '•';
}

function bodyNameEn(id: ObjId): string {
    const b = (objects as any)[id] as { name?: { en?: string } } | undefined;
    return b?.name?.en ?? String(id);
}

function bodyKind(id: ObjId): 'engine_body' | 'reference' | null {
    const b = (objects as any)[id] as { kind?: 'engine_body' | 'reference' } | undefined;
    return b?.kind ?? null;
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

function referenceDirectionVec(id: ObjId): { x: number; y: number; z: number } | null {
    const b = (objects as any)[id] as { meta?: ReferenceMeta } | undefined;
    const unit = b?.meta ? refUnit(b.meta) : null;
    if (!unit) return null;
    return { x: unit[0], y: unit[1], z: unit[2] };
}

function normalizeVec(v: Vec3d): Vec3d | null {
    const len = Math.hypot(v.x, v.y, v.z);
    if (!(len > 0)) return null;
    return { x: v.x / len, y: v.y / len, z: v.z / len };
}

function projectToEclipticPlane(v: Vec3d): Vec3d {
    return { x: v.x, y: v.y, z: 0 };
}

function dotVec(a: Vec3d, b: Vec3d): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function lookerSideBasisVec(looker: ObjId, focus: ObjId, ts: number): Vec3d | null {
    if (bodyKind(looker) === 'reference') {
        const dirEq = referenceDirectionVec(looker);
        if (!dirEq) return null;
        return normalizeVec(projectToEclipticPlane(eqToEcl(dirEq)));
    }

    const pFocus = helioVec(focus, ts);
    const pLooker = helioVec(looker, ts);
    if (!pFocus || !pLooker) return null;
    const relEq = {
        x: pLooker.x - pFocus.x,
        y: pLooker.y - pFocus.y,
        z: pLooker.z - pFocus.z
    };
    return normalizeVec(projectToEclipticPlane(eqToEcl(relEq)));
}

export function projectSystemReferenceToSide(
    looker: ObjId,
    focus: ObjId,
    target: ObjId,
    ts: number
): SystemSideProjection | null {
    const dirEq = referenceDirectionVec(target);
    if (!dirEq) return null;
    const dirEcl = normalizeVec(eqToEcl(dirEq));
    const axis = lookerSideBasisVec(looker, focus, ts);
    if (!dirEcl || !axis) return null;
    return {
        x: dotVec(dirEcl, axis),
        y: dirEcl.z,
        visible: dirEcl.z >= 0
    };
}

function referenceTargetInstant(
    looker: ObjId,
    focus: ObjId,
    target: ObjId,
    ts: number
): { phaseDeg: number; angleDeg: number; focusDistAu: number } | null {
    const projected = synodProjectedPhaseAt(looker, focus, target, ts);
    if (!projected) return null;
    const phaseDeg = projected.phaseDeg;
    return {
        phaseDeg,
        angleDeg: synodPhaseToWheelAngleDeg(phaseDeg),
        focusDistAu: projected.lookerDistAu
    };
}

function eclipticLatitudeDegAt(focus: ObjId, target: ObjId, ts: number): number {
    if (bodyKind(target) === 'reference') {
        const dirEq = referenceDirectionVec(target);
        if (!dirEq) return NaN;
        const dirEcl = eqToEcl(dirEq);
        const r = Math.hypot(dirEcl.x, dirEcl.y, dirEcl.z);
        if (!(r > 0)) return NaN;
        return (Math.asin(dirEcl.z / r) * 180) / Math.PI;
    }

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
    const synodSpokeErrorStats = (spokes: CycleSpoke<SynodMeta>[] | undefined) => {
        const stats = {
            count: 0,
            withExactTs: 0,
            badCount: 0,
            maxErrDeg: 0,
            avgErrDeg: 0
        };
        if (!spokes?.length) return stats;

        let sumErr = 0;
        for (const s of spokes) {
            stats.count += 1;
            const exactTsRaw = Number((s as any)?.meta?.exactTs);
            if (!Number.isFinite(exactTsRaw)) continue;
            stats.withExactTs += 1;

            const spokePhaseDeg = 90 + (360 * (s.index ?? 0)) / 16;
            const spokeAngleDeg = synodPhaseToWheelAngleDeg(spokePhaseDeg);
            const inst = synodInstantAt(looker, focus, target, exactTsRaw);
            if (!inst) continue;
            const errDeg = angleDeltaDeg(systemAngleDeg(inst), spokeAngleDeg);
            sumErr += errDeg;
            if (errDeg >= 5) stats.badCount += 1;
            if (errDeg > stats.maxErrDeg) stats.maxErrDeg = errDeg;
        }
        stats.avgErrDeg = stats.withExactTs > 0 ? (sumErr / stats.withExactTs) : 0;
        return {
            ...stats,
            maxErrDeg: Number(stats.maxErrDeg.toFixed(4)),
            avgErrDeg: Number(stats.avgErrDeg.toFixed(4))
        };
    };

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
        const cachedStats = synodSpokeErrorStats(xs);
        if (cachedStats.badCount > 0) {
            input.dbg?.warn?.('solveSystemWheel.synodSpokes.cachedMismatch', {
                ts: input.ts,
                looker,
                focus,
                target,
                stats: cachedStats
            });
            const freshOnMismatch = solveSynodWheel({
                wheelType: 'synod',
                ts: input.ts,
                location: input.location,
                dbg: input.dbg,
                looker,
                focus,
                target
            } as WheelInput<'synod'>);
            if (freshOnMismatch.ok) {
                const freshSpokes = freshOnMismatch.spokes as CycleSpoke<SynodMeta>[];
                const freshStats = synodSpokeErrorStats(freshSpokes);
                input.dbg?.warn?.('solveSystemWheel.synodSpokes.compareCachedFresh', {
                    ts: input.ts,
                    looker,
                    focus,
                    target,
                    cached: cachedStats,
                    fresh: freshStats
                });
            }
        }
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
        if (fresh.ok) {
            const freshSpokes = fresh.spokes as CycleSpoke<SynodMeta>[];
            const freshStats = synodSpokeErrorStats(freshSpokes);
            input.dbg?.warn?.('solveSystemWheel.synodSpokes.compareCachedFresh', {
                ts: input.ts,
                looker,
                focus,
                target,
                cached: cachedStats,
                fresh: freshStats
            });
            return freshSpokes;
        }
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
    const directSpokes = direct.spokes as CycleSpoke<SynodMeta>[];
    const directStats = synodSpokeErrorStats(directSpokes);
    if (directStats.badCount > 0) {
        input.dbg?.warn?.('solveSystemWheel.synodSpokes.directMismatch', {
            ts: input.ts,
            looker,
            focus,
            target,
            stats: directStats
        });
    }
    return directSpokes;
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
    target: ObjId,
    dbg?: WheelInput['dbg']
): SystemTrackPoint[] | undefined {
    if (!spokes?.length) return undefined;

    const out: SystemTrackPoint[] = [];
    const spokeAngleIssues: Array<Record<string, unknown>> = [];
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
        const instAngleDeg = systemAngleDeg(inst);
        const spokeVsInstantErr = angleDeltaDeg(instAngleDeg, spokeAngleDeg);
        if (spokeVsInstantErr >= 5) {
            spokeAngleIssues.push({
                ts: Math.round(nodeTs),
                code: s.code,
                index: s.index,
                spokeAngleDeg: Number(spokeAngleDeg.toFixed(4)),
                instantAngleDeg: Number(instAngleDeg.toFixed(4)),
                errDeg: Number(spokeVsInstantErr.toFixed(4))
            });
        }
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
            planeDistanceAu: Number.isFinite(eclLat) ? (inst.distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN,
            planeDistanceRatio: NaN,
            tags: tags.length ? tags : undefined,
            meta: {
                ...(s.meta && typeof s.meta === 'object' ? (s.meta as Record<string, unknown>) : {}),
                phaseDeg: spokePhaseNormDeg,
                eclipticLatDeg: eclLat,
                distanceAu: inst.distanceAu,
                distanceKm: inst.distanceAu * AU_KM,
                focusDistAu: inst.focusDistAu,
                planeDistanceAu: Number.isFinite(eclLat) ? (inst.distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN
            }
        });
    }
    if (spokeAngleIssues.length > 0) {
        dbg?.warn?.('solveSystemWheel.synodSpokeAngleMismatch', {
            looker,
            focus,
            target,
            count: spokeAngleIssues.length,
            issues: spokeAngleIssues.slice(0, 12)
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
    target: ObjId,
    dbg?: WheelInput['dbg']
): SystemTrackPoint[] | undefined {
    if (!points || points.length < 2) return points;

    const unwrapped = unwrapTrackAnglesByTs(points);
    const out: SystemTrackPoint[] = [];
    const densifyIssues: Array<Record<string, unknown>> = [];

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
            const solvedAngleDeg = systemAngleDeg(inst);
            const branch = Math.round((targetUnwrapped - solvedAngleDeg) / 360);
            const solvedUnwrapped = solvedAngleDeg + 360 * branch;
            const targetErrDeg = solvedUnwrapped - targetUnwrapped;
            if (!Number.isFinite(tMid) || Math.abs(targetErrDeg) >= 8) {
                densifyIssues.push({
                    segment: {
                        fromTs: Math.round(a.ts),
                        toTs: Math.round(b.ts),
                        fromCode: a.code,
                        toCode: b.code,
                        fromUnwrapped: Number(a.angleUnwrapped.toFixed(4)),
                        toUnwrapped: Number(b.angleUnwrapped.toFixed(4))
                    },
                    insert: {
                        u: Number(u.toFixed(4)),
                        targetUnwrapped: Number(targetUnwrapped.toFixed(4)),
                        tsMid: Math.round(tsMid),
                        rootTs: Number.isFinite(tMid) ? Math.round(tMid as number) : null,
                        solvedAngleDeg: Number(solvedAngleDeg.toFixed(4)),
                        solvedUnwrapped: Number(solvedUnwrapped.toFixed(4)),
                        errDeg: Number(targetErrDeg.toFixed(4))
                    }
                });
            }

            out.push({
                ts: tsMid,
                index: a.index,
                code: a.code,
                azimuthDeg: pseudoAzimuthFromWheelAngle(solvedAngleDeg),
                altitudeDeg: eclLat,
                angleDeg: solvedAngleDeg,
                orbit: NaN,
                visible: Number.isFinite(eclLat) ? eclLat >= 0 : true,
                source: 'cycle',
                sourceWheel: 'synod',
                phaseDeg: systemPhaseDeg(inst),
                distanceAu: inst.distanceAu,
                focusDistAu: inst.focusDistAu,
                planeDistanceAu: Number.isFinite(eclLat) ? (inst.distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN,
                planeDistanceRatio: NaN,
                meta: {
                    phaseDeg: systemPhaseDeg(inst),
                    eclipticLatDeg: eclLat,
                    distanceAu: inst.distanceAu,
                    distanceKm: inst.distanceAu * AU_KM,
                    focusDistAu: inst.focusDistAu,
                    planeDistanceAu: Number.isFinite(eclLat) ? (inst.distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN
                }
            });
        }
    }

    const last = unwrapped[unwrapped.length - 1];
    out.push({ ...last, angleDeg: last.angleDeg });
    if (densifyIssues.length > 0) {
        dbg?.warn?.('solveSystemWheel.densifyAngleMismatch', {
            looker,
            focus,
            target,
            count: densifyIssues.length,
            issues: densifyIssues.slice(0, 16)
        });
    }
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
            planeDistanceAu: Number.isFinite(eclLat) ? (distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN,
            planeDistanceRatio: NaN,
            tags: tags.length ? tags : undefined,
            meta: {
                ...(s.meta && typeof s.meta === 'object' ? (s.meta as Record<string, unknown>) : {}),
                phaseDeg: systemPhaseDeg(inst),
                eclipticLatDeg: eclLat,
                distanceAu,
                distanceKm: distanceAu * AU_KM,
                focusDistAu: inst.focusDistAu,
                planeDistanceAu: Number.isFinite(eclLat) ? (distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN
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
            planeDistanceAu: Number.isFinite(eclLat) ? (inst.distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN,
            planeDistanceRatio: NaN,
            tags: tags.length ? tags : undefined,
            meta: {
                ...(s.meta && typeof s.meta === 'object' ? (s.meta as Record<string, unknown>) : {}),
                phaseDeg: systemPhaseDeg(inst),
                eclipticLatDeg: eclLat,
                distanceAu: inst.distanceAu,
                distanceKm: inst.distanceAu * AU_KM,
                focusDistAu: inst.focusDistAu,
                planeDistanceAu: Number.isFinite(eclLat) ? (inst.distanceAu * Math.sin((eclLat * Math.PI) / 180)) : NaN
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

function angleDeltaDeg(a: number, b: number): number {
    let d = Math.abs(a - b);
    while (d > 360) d -= 360;
    if (d > 180) d = 360 - d;
    return d;
}

function synodHouseFromPhaseDeg(phaseDeg: number): string | undefined {
    if (!Number.isFinite(phaseDeg)) return undefined;

    let bestId: string | undefined;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < SPOKES_ORDER.length; i++) {
        const centerDeg = norm360(90 + i * (360 / SPOKES_ORDER.length));
        let dist = Math.abs(norm360(phaseDeg) - centerDeg);
        if (dist > 180) dist = 360 - dist;
        if (dist < bestDist) {
            bestDist = dist;
            bestId = SPOKES_ORDER[i];
        }
    }
    return bestId;
}

function normalizeOrbit(distanceAu: number, maxAu: number): number {
    if (!(distanceAu > 0) || !Number.isFinite(distanceAu)) return 0;
    if (!(maxAu > 0) || !Number.isFinite(maxAu)) return 0;
    return clamp(distanceAu / maxAu, 0, 1);
}

export function projectSystemSideCoordinates(
    angleDeg: number,
    distanceRatio: number,
    planeDistanceRatio: number
): SystemSideProjection {
    const angleRad = (angleDeg * Math.PI) / 180;
    const radius = Number.isFinite(distanceRatio) ? distanceRatio : 0;
    const x = radius * Math.cos(angleRad);
    const y = Number.isFinite(planeDistanceRatio) ? planeDistanceRatio : 0;
    return {
        x,
        y,
        visible: Number.isFinite(planeDistanceRatio) ? planeDistanceRatio >= 0 : true
    };
}

export function projectSystemTargetToSide(
    target: Pick<SystemTargetState, 'angleDeg' | 'orbit' | 'planeDistanceRatio'>
): SystemSideProjection {
    return projectSystemSideCoordinates(target.angleDeg, target.orbit, target.planeDistanceRatio);
}

export function systemLookerSideDirection(looker: ObjId, focus: ObjId, ts: number): 'N' | 'S' {
    const latDeg = eclipticLatitudeDegAt(focus, looker, ts);
    if (!Number.isFinite(latDeg)) return 'S';
    return latDeg > 0 ? 'N' : 'S';
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
        kind: 'engine_body' | 'reference';
        angleDeg: number;
        phaseDeg: number;
        distanceAu: number;
        focusDistAu: number;
        currentHouses: {
            synod?: string;
            bind?: string;
            nodal?: string;
        };
        orbitTrack?: SystemTrackPoint[];
    } | null> => {
        const kind = bodyKind(id);
        if (!kind) return null;
        if (kind === 'reference') {
            const inst = referenceTargetInstant(looker, focus, id, ts);
            if (!inst) return null;
            return {
                id,
                kind,
                angleDeg: inst.angleDeg,
                phaseDeg: inst.phaseDeg,
                distanceAu: NaN,
                focusDistAu: inst.focusDistAu,
                currentHouses: {
                    synod: synodHouseFromPhaseDeg(inst.phaseDeg)
                }
            };
        }

        const inst = synodInstantAt(looker, focus, id, ts);
        if (!inst) return null;

        const synodSpokes = await resolveSynodSpokesForTarget(input, looker, focus, id);
        const synodTrack = buildTrackFromSynodSpokes(synodSpokes, looker, focus, id, dbg);

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
        const denseTrack = densifyTrackByAngleGap(mergedTrack, looker, focus, id, dbg);
        const orbitTrackRaw = mergeTrackPointsPreferSynod(denseTrack);
        const orbitTrackTagged = applySystemBoundaryCycleTags(orbitTrackRaw);
        const orbitTrack = trackInMainCycleWindow(orbitTrackTagged, systemSpec.mainCycle, ts);
        const currentHouses = {
            synod: currentHouseAtTs(synodSpokes, ts),
            bind: currentHouseAtTs(bindSpokes, ts),
            nodal: currentHouseAtTs(nodalSpokes, ts)
        };

        return {
            id,
            kind,
            angleDeg: systemAngleDeg(inst),
            phaseDeg: systemPhaseDeg(inst),
            distanceAu: inst.distanceAu,
            focusDistAu: inst.focusDistAu,
            currentHouses,
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
        if (r.kind !== 'engine_body') return [];
        const vals = [r.distanceAu];
        if (r.orbitTrack?.length) vals.push(...r.orbitTrack.map((p) => p.distanceAu));
        return vals.filter((x) => Number.isFinite(x) && x > 0);
    });
    const maxAu = distances.length ? Math.max(...distances) : 1;

    const bodies: SystemTargetState[] = rows.map((r) => {
        const orbit = r.kind === 'reference'
            ? SYSTEM_REFERENCE_RING_ORBIT
            : normalizeOrbit(r.distanceAu, maxAu);
        const eclLat = eclipticLatitudeDegAt(focus, r.id, ts);
        const planeDistanceAu = r.kind === 'engine_body' && Number.isFinite(eclLat)
            ? (r.distanceAu * Math.sin((eclLat * Math.PI) / 180))
            : NaN;
        const planeDistanceRatio = r.kind === 'engine_body' && Number.isFinite(planeDistanceAu)
            ? (planeDistanceAu / maxAu)
            : NaN;

        const orbitTrack = r.orbitTrack?.map((p) => {
            const o = normalizeOrbit(p.distanceAu, maxAu);
            return {
                ...p,
                orbit: o,
                planeDistanceRatio: Number.isFinite(p.planeDistanceAu)
                    ? (p.planeDistanceAu / maxAu)
                    : NaN,
                visible: Number.isFinite(p.altitudeDeg) ? p.altitudeDeg >= 0 : true
            };
        });

        return {
            id: r.id,
            kind: r.kind,
            azimuthDeg: pseudoAzimuthFromWheelAngle(r.angleDeg),
            altitudeDeg: eclLat,
            angleDeg: r.angleDeg,
            orbit,
            visible: Number.isFinite(eclLat) ? eclLat >= 0 : true,
            orbitTrack,
            phaseDeg: r.phaseDeg,
            distanceAu: r.distanceAu,
            focusDistAu: r.focusDistAu,
            planeDistanceAu,
            planeDistanceRatio,
            distanceLabel: r.kind === 'reference' ? '' : `Dist to ${bodyNameEn(focus)}`,
            currentHouses: r.currentHouses,
            infoMeta: {
                synod: {
                    phaseDeg: r.phaseDeg,
                    distanceAu: r.distanceAu,
                    distanceKm: Number.isFinite(r.distanceAu) ? r.distanceAu * AU_KM : NaN,
                    focusDistAu: r.focusDistAu,
                    eclipticLatDeg: eclLat
                },
                bind: r.kind === 'engine_body' ? {
                    distanceAu: r.distanceAu,
                    distanceKm: r.distanceAu * AU_KM
                } : undefined,
                nodal: r.kind === 'engine_body' ? {
                    nodalLatitudeDeg: eclLat,
                    distanceAu: r.distanceAu,
                    distanceKm: r.distanceAu * AU_KM,
                    planeDistanceAu,
                    planeDistanceKm: Number.isFinite(planeDistanceAu) ? (planeDistanceAu * AU_KM) : NaN
                } : undefined
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
            description: Number.isFinite(t.distanceAu)
                ? `Distance ${t.distanceAu.toFixed(5)} AU, phase ${t.phaseDeg.toFixed(1)}°`
                : `Phase ${t.phaseDeg.toFixed(1)}°`,
            opacity: 1
        };
    });
}
