// src/lib/math/compass.ts
import { objects } from '../catalog';
import type { ObjId } from '../catalog';
import type { MarkerItem } from '../wheel/wheel'; // если путь у тебя другой — скажи, поправлю

import type { WheelInput, CompassSolveResult, CycleSpoke } from '../board/runtime';
import { resolveWheel } from '../board/dispatcher';
import {toSigned180} from "./helpers";
import { computeHorizonInstant, type HorizonMeta } from './horizon';

export type CompassTrackPoint = {
    ts: number;
    index: number;
    code: string;
    azimuthDeg: number;
    altitudeDeg: number;
    angleDeg: number;
    orbit: number;
    visible: boolean;
    source?: 'cycle' | 'spoke' | 'seam';
};

export type CompassTargetState = {
    id: ObjId;
    azimuthDeg: number;   // [0..360)
    altitudeDeg: number;  // [-90..+90]
    angleDeg: number;     // wheel angle from azimuth
    orbit: number;        // radial coefficient [0..2]
    visible: boolean;
    cycleSpokes?: CycleSpoke<HorizonMeta>[];
    orbitTrack?: CompassTrackPoint[];

    raHours?: number;
    decDeg?: number;
    distanceAu?: number;
    distanceLabel?: string;
};

const COMPASS_SPOKES = ['E', 'ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'] as const;

function bodyEmoji(id: ObjId): string {
    const b = (objects as any)[id] as { emoji?: string } | undefined;
    return b?.emoji ?? '•';
}

function bodyNameEn(id: ObjId): string {
    const b = (objects as any)[id] as { name?: { en?: string } } | undefined;
    return b?.name?.en ?? String(id);
}

/**
 * Главный solver для registry/runtime.
 * Берёт:
 * - ts из WheelInput
 * - looker из WheelInput (по умолчанию Earth)
 * - targets из WheelInput.target (ObjId или ObjId[])
 * - observer из WheelInput.location (lat/lon)
 *
 * Возвращает:
 * - CompassSolveResult из board/runtime: kind='compass', objects=[]
 */
function locationCacheKeyPart(loc: WheelInput['location']): string {
    if (typeof loc?.id === 'string' && loc.id.trim()) return loc.id;
    return 'loc:system';
}

async function resolveHorizonSpokesForTarget(input: WheelInput, target: ObjId): Promise<CycleSpoke<HorizonMeta>[] | undefined> {
    const loc = input.location;
    if (!loc) return undefined;

    const virtualHorizonWheel = {
        wheelType: 'horizon' as const,
        roles: { looker: 'Earth', target },
        observer: { locationId: locationCacheKeyPart(loc) }
    };

    const res = await resolveWheel(virtualHorizonWheel as any, {
        ts: input.ts,
        location: loc,
        dbg: input.dbg
    });

    if (!res || res.kind !== 'cycle' || !res.ok) return undefined;
    return res.spokes as CycleSpoke<HorizonMeta>[];
}

function buildTrackFromHorizonSpokes(spokes: CycleSpoke<HorizonMeta>[] | undefined): CompassTrackPoint[] | undefined {
    if (!spokes?.length) return undefined;

    const out: CompassTrackPoint[] = [];
    for (const s of spokes) {
        const az = Number(s.meta?.azimuthDeg);
        const alt = Number(s.meta?.altitudeDeg);
        const orbit = Number(s.meta?.orbit);
        if (!Number.isFinite(az) || !Number.isFinite(alt) || !Number.isFinite(orbit)) continue;

        out.push({
            ts: s.ts,
            index: s.index,
            code: s.code,
            azimuthDeg: az,
            altitudeDeg: alt,
            angleDeg: azimuthToWheelAngleDeg(az),
            orbit,
            visible: alt >= 0,
            source: 'cycle'
        });
    }
    return out;
}

function unwrapAnglesByTs(points: CompassTrackPoint[]): Array<CompassTrackPoint & { angleUnwrapped: number }> {
    const sorted = points.slice().sort((a, b) => a.ts - b.ts);
    const out: Array<CompassTrackPoint & { angleUnwrapped: number }> = [];
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

function spokeAngleByIndex(i: number): number {
    return toSigned180(-22.5 * i);
}

function computeSpokeIntersectionsAboveHorizon(opts: {
    looker: ObjId;
    target: ObjId;
    location: WheelInput['location'];
    baseTrack: CompassTrackPoint[] | undefined;
}): CompassTrackPoint[] {
    const { looker, target, location, baseTrack } = opts;
    if (!location || !baseTrack || baseTrack.length < 2) return [];

    const xs = unwrapAnglesByTs(baseTrack);
    const out: CompassTrackPoint[] = [];
    const SEGMENT_SAMPLES = 10;
    const BISECT_ITERS = 20;
    const ROOT_EPS_DEG = 0.03;
    const TS_DEDUP_MS = 60_000;

    const pushUnique = (p: CompassTrackPoint) => {
        const hit = out.find((q) =>
            q.code === p.code &&
            Math.abs(q.ts - p.ts) <= TS_DEDUP_MS
        );
        if (!hit) out.push(p);
    };

    for (let i = 0; i < xs.length - 1; i++) {
        const a = xs[i];
        const b = xs[i + 1];
        if (!(b.ts > a.ts)) continue;
        if (Math.max(a.altitudeDeg, b.altitudeDeg) < 0) continue;
        if (a.angleUnwrapped === b.angleUnwrapped) continue;

        const lo = Math.min(a.angleUnwrapped, b.angleUnwrapped);
        const hi = Math.max(a.angleUnwrapped, b.angleUnwrapped);

        for (let si = 0; si < COMPASS_SPOKES.length; si++) {
            const spokeCode = COMPASS_SPOKES[si];
            const spokeBase = spokeAngleByIndex(si);
            const kMin = Math.ceil((lo - spokeBase) / 360);
            const kMax = Math.floor((hi - spokeBase) / 360);
            for (let k = kMin; k <= kMax; k++) {
                const targetUnwrapped = spokeBase + 360 * k;

                type HorizonInstant = Exclude<ReturnType<typeof computeHorizonInstant>, null>;
                const diffAtTs = (ts: number): { diff: number; inst: HorizonInstant } | null => {
                    const inst = computeHorizonInstant({ ts, looker, target, location });
                    if (!inst) return null;
                    const ang = azimuthToWheelAngleDeg(inst.azimuthDeg);
                    const branch = Math.round((targetUnwrapped - ang) / 360);
                    const angUnwrapped = ang + 360 * branch;
                    return { diff: angUnwrapped - targetUnwrapped, inst };
                };

                const samples: Array<{ ts: number; diff: number }> = [];
                for (let s = 0; s <= SEGMENT_SAMPLES; s++) {
                    const u = s / SEGMENT_SAMPLES;
                    const t = a.ts + (b.ts - a.ts) * u;
                    const d = diffAtTs(t);
                    if (!d) continue;
                    samples.push({ ts: t, diff: d.diff });
                }
                if (samples.length < 2) continue;

                let loTs = NaN;
                let hiTs = NaN;
                let loD = 0;
                let hiD = 0;
                let bestAbs = Number.POSITIVE_INFINITY;
                let bestTs = samples[0].ts;

                for (let j = 0; j < samples.length - 1; j++) {
                    const s0 = samples[j];
                    const s1 = samples[j + 1];
                    const a0 = Math.abs(s0.diff);
                    const a1 = Math.abs(s1.diff);
                    if (a0 < bestAbs) {
                        bestAbs = a0;
                        bestTs = s0.ts;
                    }
                    if (a1 < bestAbs) {
                        bestAbs = a1;
                        bestTs = s1.ts;
                    }
                    if (s0.diff === 0 || s1.diff === 0 || s0.diff * s1.diff <= 0) {
                        loTs = s0.ts;
                        hiTs = s1.ts;
                        loD = s0.diff;
                        hiD = s1.diff;
                        break;
                    }
                }

                let t = bestTs;
                if (Number.isFinite(loTs) && Number.isFinite(hiTs)) {
                    for (let it = 0; it < BISECT_ITERS; it++) {
                        const mid = (loTs + hiTs) * 0.5;
                        const dMid = diffAtTs(mid);
                        if (!dMid) break;
                        if (Math.abs(dMid.diff) <= ROOT_EPS_DEG) {
                            loTs = mid;
                            hiTs = mid;
                            break;
                        }
                        if (loD === 0) {
                            hiTs = loTs;
                            break;
                        }
                        if (hiD === 0) {
                            loTs = hiTs;
                            break;
                        }
                        if (loD * dMid.diff <= 0) {
                            hiTs = mid;
                            hiD = dMid.diff;
                        } else {
                            loTs = mid;
                            loD = dMid.diff;
                        }
                    }
                    t = (loTs + hiTs) * 0.5;
                }

                const final = diffAtTs(t);
                if (!final) continue;
                if (Math.abs(final.diff) > 0.35) continue;
                if (final.inst.altitudeDeg < 0) continue;

                pushUnique({
                    ts: t,
                    index: si,
                    code: spokeCode,
                    azimuthDeg: final.inst.azimuthDeg,
                    altitudeDeg: final.inst.altitudeDeg,
                    angleDeg: spokeBase,
                    orbit: final.inst.orbit,
                    visible: final.inst.visible,
                    source: 'spoke'
                });
            }
        }
    }

    return out;
}

function computeHorizonStyleSeams(opts: {
    looker: ObjId;
    target: ObjId;
    location: WheelInput['location'];
    track: CompassTrackPoint[] | undefined;
}): CompassTrackPoint[] {
    const { looker, target, location, track } = opts;
    if (!location || !track || track.length < 2) return [];

    const xs = track.slice().sort((a, b) => a.ts - b.ts);
    const out: CompassTrackPoint[] = [];
    const ROOT_EPS_DEG = 0.01;
    const BISECT_ITERS = 20;
    const TS_DEDUP_MS = 30_000;

    const pushUnique = (p: CompassTrackPoint) => {
        const hit = out.find((q) => Math.abs(q.ts - p.ts) <= TS_DEDUP_MS);
        if (!hit) out.push(p);
    };

    for (let i = 0; i < xs.length - 1; i++) {
        const a = xs[i];
        const b = xs[i + 1];
        if (!(b.ts > a.ts)) continue;
        if (a.visible === b.visible) continue;

        let lo = a.ts;
        let hi = b.ts;
        let altLo = a.altitudeDeg;
        let altHi = b.altitudeDeg;

        if (!(Number.isFinite(altLo) && Number.isFinite(altHi))) continue;
        if (altLo === 0) hi = lo;
        else if (altHi === 0) lo = hi;
        else if (altLo * altHi > 0) continue;
        else {
            for (let it = 0; it < BISECT_ITERS; it++) {
                const mid = (lo + hi) * 0.5;
                const instMid = computeHorizonInstant({ ts: mid, looker, target, location });
                if (!instMid) break;
                const altMid = instMid.altitudeDeg;
                if (Math.abs(altMid) <= ROOT_EPS_DEG) {
                    lo = mid;
                    hi = mid;
                    break;
                }
                if (altLo * altMid <= 0) {
                    hi = mid;
                    altHi = altMid;
                } else {
                    lo = mid;
                    altLo = altMid;
                }
                if (Math.abs(hi - lo) <= 500) break;
            }
        }

        const ts = (lo + hi) * 0.5;
        const inst = computeHorizonInstant({ ts, looker, target, location });
        if (!inst) continue;

        pushUnique({
            ts,
            index: a.index,
            code: 'HZ',
            azimuthDeg: inst.azimuthDeg,
            altitudeDeg: 0,
            angleDeg: azimuthToWheelAngleDeg(inst.azimuthDeg),
            orbit: 1,
            visible: inst.altitudeDeg >= 0,
            source: 'seam'
        });
    }

    return out.sort((x, y) => x.ts - y.ts);
}

function mergeTrackPointsPreferSpokes(points: CompassTrackPoint[] | undefined): CompassTrackPoint[] | undefined {
    if (!points?.length) return points;

    const sorted = points
        .slice()
        .sort((a, b) => (a.ts - b.ts) || (a.angleDeg - b.angleDeg));

    const merged: CompassTrackPoint[] = [];
    const ANG_EPS = 1.2;
    const ORBIT_EPS = 0.02;
    const TS_EPS = 10 * 60_000;

    const angDist = (a: number, b: number) => {
        let d = Math.abs(a - b);
        while (d > 360) d -= 360;
        if (d > 180) d = 360 - d;
        return d;
    };

    for (const p of sorted) {
        const hitIdx = merged.findIndex((m) =>
            Math.abs(m.ts - p.ts) <= TS_EPS &&
            angDist(m.angleDeg, p.angleDeg) <= ANG_EPS &&
            Math.abs(m.orbit - p.orbit) <= ORBIT_EPS
        );

        if (hitIdx < 0) {
            merged.push(p);
            continue;
        }

        const prev = merged[hitIdx];
        const isBoundaryCode = (code: string) => code === 'E' || code === 'E+' || code === 'E_next';
        const prevBoundary = isBoundaryCode(prev.code);
        const pBoundary = isBoundaryCode(p.code);

        const rank = (x: CompassTrackPoint) => {
            if (x.source === 'seam') return 3;
            if (x.source === 'spoke') return 2;
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

export async function solveCompassWheel(input: WheelInput): Promise<CompassSolveResult<CompassTargetState>> {
    const dbg = input.dbg;

    const ts = input.ts;
    const looker = (input.looker ?? 'Earth') as ObjId;

    const loc = input.location;
    if (!loc) {
        const reason = 'Compass wheel requires location (input.location is missing).';
        dbg?.warn?.('solveCompassWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    // targets из input.target (обязателен по твоему правилу)
    const rawTarget = input.target;
    const targets: ObjId[] = Array.isArray(rawTarget) ? rawTarget : [rawTarget];

    dbg?.log?.('solveCompassWheel.in', { ts, looker, targets, loc });

    if (looker !== 'Earth') {
        const reason = `Compass: topocentric horizon supported only for looker=Earth (got ${String(looker)}).`;
        dbg?.warn?.('solveCompassWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    if (!targets.length) {
        const reason = 'Compass: target list is empty.';
        dbg?.warn?.('solveCompassWheel.fail', reason);
        return { ok: false, kind: 'compass', ts, reason, bodies: [] };
    }

    const out = await Promise.all(targets.map(async (id): Promise<CompassTargetState | null> => {
        try {
            const instant = computeHorizonInstant({
                ts,
                looker,
                target: id,
                location: loc
            });
            if (!instant) return null;

            const cycleSpokes = await resolveHorizonSpokesForTarget(input, id);
            const baseTrack = buildTrackFromHorizonSpokes(cycleSpokes);
            const spokeTrack = computeSpokeIntersectionsAboveHorizon({
                looker,
                target: id,
                location: loc,
                baseTrack
            });
            const seamTrack = computeHorizonStyleSeams({
                looker,
                target: id,
                location: loc,
                track: baseTrack
            });
            const orbitTrack = mergeTrackPointsPreferSpokes([...(baseTrack ?? []), ...spokeTrack, ...seamTrack]);

            return {
                id,
                azimuthDeg: instant.azimuthDeg,
                altitudeDeg: instant.altitudeDeg,
                angleDeg: azimuthToWheelAngleDeg(instant.azimuthDeg),
                orbit: instant.orbit,
                visible: instant.visible,
                cycleSpokes,
                orbitTrack,
                raHours: instant.raHours,
                decDeg: instant.decDeg,
                distanceAu: instant.distanceAu,
                distanceLabel: `Dist to ${bodyNameEn(looker)}`
            };
        } catch (err) {
            dbg?.warn?.('solveCompassWheel.targetError', { id, err });
            return null;
        }
    }));

    const bodies = out.filter((x): x is CompassTargetState => !!x);

    dbg?.log?.('solveCompassWheel.out', { count: bodies.length, ids: bodies.map(x => x.id) });

    return { ok: true, kind: 'compass', ts, bodies };
}

/**
 * Convert geodetic azimuth (0=N, 90=E) -> wheel angle for your SVG geom
 * (0=E, -90=N, ±180=W, +90=S).
 */
function azimuthToWheelAngleDeg(azimuthDeg: number): number {
    return toSigned180(azimuthDeg - 90);
}

/**
 * UI helper (как и раньше): вычисленные objects -> MarkerItem[]
 * Эту штуку обычно дергает Compass.svelte.
 */
export function compassTargetsToMarkerItems(
    ts: number,
    targets: CompassTargetState[],
    looker: ObjId = 'Earth'
): MarkerItem[] {
    const collectionId = `compass:${String(looker)}`;

    return targets.map((t) => {
        const baseId = `body:${String(t.id)}`;
        const emoji = bodyEmoji(t.id);
        const name = bodyNameEn(t.id);

        return {
            id: `compass:${String(looker)}:${String(t.id)}@${ts}`,
            baseId,
            collectionId,

            ts,
            angleDeg: t.angleDeg,
            orbit: t.orbit,

            bg: 'transparent',
            emoji,

            title: name,
            description: t.visible
                ? `Alt ${t.altitudeDeg.toFixed(1)}°, Az ${t.azimuthDeg.toFixed(1)}°`
                : `Below horizon (${t.altitudeDeg.toFixed(1)}°)`,

            opacity: t.visible ? 1 : 0.6
        };
    });
}
