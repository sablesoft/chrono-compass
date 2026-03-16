// src/lib/math/compass.ts
import { AstroTime, Horizon, Observer, RotateVector, Rotation_ECT_EQD, Vector } from 'astronomy-engine';
import type {ObjId} from '../catalog';
import {objects} from '../catalog';
import {cycleSpokeTags} from '../catalog/tags';
import type {MarkerItem} from '../wheel/types';
import type {CompassSolveResult, CycleSpoke, WheelInput} from '../board/runtime';
import {resolveWheel} from '../board/dispatcher';
import {currentHouseAtTs, toSigned180, trackInMainCycleWindow} from "./helpers";
import { classifyHorizonVisibility, computeHorizonInstant, orbitFromAltitudeDeg, type HorizonMeta } from './horizon';
import { compass as compassSpec } from '../catalog/wheels/compass';
import { constellationEntriesFromObjects, findConstellationByRaDec } from './constellation';
import { synodProjectedPhaseAt } from './synod';

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
    tags?: string[];
    sourceWheel?: 'horizon' | 'compass' | 'synod' | 'bind' | 'nodal';
    meta?: Record<string, unknown>;
};

export type CompassTargetState = {
    id: ObjId;
    azimuthDeg: number;   // [0..360)
    altitudeDeg: number;  // [-90..+90]
    angleDeg: number;     // wheel angle from azimuth
    orbit: number;        // radial coefficient [0..2]
    visible: boolean;
    currentHouses?: {
        horizon?: string;
        compass?: string;
    };
    orbitTrack?: CompassTrackPoint[];
    infoMeta?: {
        horizon: Record<string, unknown>;
    };

    raHours?: number;
    decDeg?: number;
    distanceAu?: number;
    distanceLabel?: string;
    moonPhaseEmoji?: string;
    moonPhaseName?: string;
    moonPhaseFraction?: number;
    moonPhaseRotationDeg?: number;
};

export type CompassAstroFrameCurveKind = 'equator' | 'ecliptic';
export type CompassAstroFrameNodeKind = 'intersection' | 'pole';

export type CompassAstroFrameCurve = {
    id: CompassAstroFrameCurveKind;
    label: string;
    color: string;
    track: CompassTrackPoint[];
};

export type CompassAstroFrameNode = {
    id: string;
    label: string;
    kind: CompassAstroFrameNodeKind;
    ts: number;
    azimuthDeg: number;
    altitudeDeg: number;
    angleDeg: number;
    orbit: number;
    visible: boolean;
    emoji: string;
    color?: string;
    meta?: {
        raHours: number;
        decDeg: number;
        constellationAbbr?: string;
        constellationName?: string;
        constellationEmoji?: string;
    };
};

export type CompassAstroFrameLayer = {
    curves: CompassAstroFrameCurve[];
    nodes: CompassAstroFrameNode[];
};

const COMPASS_SPOKES = ['E', 'ENE', 'NE', 'NNE', 'N', 'NNW', 'NW', 'WNW', 'W', 'WSW', 'SW', 'SSW', 'S', 'SSE', 'SE', 'ESE'] as const;

function bodyEmoji(id: ObjId): string {
    const b = (objects as any)[id] as { emoji?: string } | undefined;
    return b?.emoji ?? '•';
}

function bodyColor(id: ObjId): string | undefined {
    const b = (objects as any)[id] as { meta?: { color?: string } } | undefined;
    const color = b?.meta?.color;
    return typeof color === 'string' && color.trim().length > 0 ? color.trim() : undefined;
}

function bodyNameEn(id: ObjId): string {
    const b = (objects as any)[id] as { name?: string } | undefined;
    return b?.name ?? String(id);
}

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
        const tags = uniqueTags(Array.isArray(s.tags) ? s.tags : []);
        out.push({
            ts: s.ts,
            index: s.index,
            code: s.code,
            azimuthDeg: az,
            altitudeDeg: alt,
            angleDeg: azimuthToWheelAngleDeg(az),
            orbit,
            visible: alt >= 0,
            source: 'cycle',
            tags: tags.length ? tags : undefined,
            sourceWheel: 'horizon',
            meta: (s.meta && typeof s.meta === 'object') ? ({ ...(s.meta as Record<string, unknown>) }) : undefined
        });
    }
    return out;
}

function buildTrackFromInstantSamples(opts: {
    looker: ObjId;
    target: ObjId;
    location: WheelInput['location'];
    fromTs: number;
    toTs: number;
    stepMinutes?: number;
    sourceWheel?: 'horizon' | 'compass';
}): CompassTrackPoint[] | undefined {
    const { looker, target, location, fromTs, toTs } = opts;
    if (!location) return undefined;
    if (!Number.isFinite(fromTs) || !Number.isFinite(toTs) || toTs <= fromTs) return undefined;
    const stepMinutes = Number.isFinite(opts.stepMinutes) ? Math.max(5, opts.stepMinutes as number) : 30;
    const stepMs = stepMinutes * 60_000;
    const sourceWheel = opts.sourceWheel ?? 'horizon';

    const out: CompassTrackPoint[] = [];
    for (let t = fromTs; t <= toTs + 1; t += stepMs) {
        const inst = computeHorizonInstant({ ts: t, looker, target, location });
        if (!inst) continue;
        out.push({
            ts: t,
            index: 0,
            code: 'E',
            azimuthDeg: inst.azimuthDeg,
            altitudeDeg: inst.altitudeDeg,
            angleDeg: azimuthToWheelAngleDeg(inst.azimuthDeg),
            orbit: inst.orbit,
            visible: inst.visible,
            source: 'cycle',
            sourceWheel,
            meta: {
                altitudeDeg: inst.altitudeDeg,
                azimuthDeg: inst.azimuthDeg,
                orbit: inst.orbit,
                raHours: inst.raHours,
                decDeg: inst.decDeg,
                distanceAu: inst.distanceAu,
                distanceKm: inst.distanceKm
            }
        });
    }

    return out.length >= 2 ? out : undefined;
}

function buildTrackFromInstantSamplesCentered(opts: {
    looker: ObjId;
    target: ObjId;
    location: WheelInput['location'];
    ts: number;
    windowHours?: number;
    stepMinutes?: number;
    sourceWheel?: 'horizon' | 'compass';
}): CompassTrackPoint[] | undefined {
    const { ts } = opts;
    const windowHours = Number.isFinite(opts.windowHours) ? Math.max(1, opts.windowHours as number) : 24;
    const halfMs = (windowHours * 60 * 60_000) / 2;
    return buildTrackFromInstantSamples({
        looker: opts.looker,
        target: opts.target,
        location: opts.location,
        fromTs: ts - halfMs,
        toTs: ts + halfMs,
        stepMinutes: opts.stepMinutes,
        sourceWheel: opts.sourceWheel
    });
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

function computeSpokeIntersectionsCompass(opts: {
    looker: ObjId;
    target: ObjId;
    location: WheelInput['location'];
    baseTrack: CompassTrackPoint[] | undefined;
    sourceWheel?: 'horizon' | 'compass';
}): CompassTrackPoint[] {
    const { looker, target, location, baseTrack } = opts;
    if (!location || !baseTrack || baseTrack.length < 2) return [];

    const xs = unwrapAnglesByTs(baseTrack);
    const out: CompassTrackPoint[] = [];
    const SEGMENT_SAMPLES = 12;
    const BISECT_ITERS = 26;
    const ROOT_EPS_DEG = 0.03;
    const ROOT_MAX_ERR_DEG = 0.12;
    const ROOT_MAX_TS_DRIFT_FACTOR = 0.45;
    const ROOT_MAX_ORBIT_DRIFT = 0.32;
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
                const diffAtTs = (ts: number): { diff: number; inst: HorizonInstant; angUnwrapped: number } | null => {
                    const inst = computeHorizonInstant({ ts, looker, target, location });
                    if (!inst) return null;
                    const ang = azimuthToWheelAngleDeg(inst.azimuthDeg);
                    const uRaw = (ts - a.ts) / (b.ts - a.ts);
                    const u = Math.max(0, Math.min(1, uRaw));
                    const predicted = a.angleUnwrapped + (b.angleUnwrapped - a.angleUnwrapped) * u;
                    const branch = Math.round((predicted - ang) / 360);
                    const angUnwrapped = ang + 360 * branch;
                    return { diff: angUnwrapped - targetUnwrapped, inst, angUnwrapped };
                };

                const uGuessRaw = (targetUnwrapped - a.angleUnwrapped) / (b.angleUnwrapped - a.angleUnwrapped);
                const uGuess = Math.max(0, Math.min(1, uGuessRaw));
                const tGuess = a.ts + (b.ts - a.ts) * uGuess;

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
                let bestTs = tGuess;
                let bestBracketDist = Number.POSITIVE_INFINITY;

                for (let j = 0; j < samples.length; j++) {
                    const sj = samples[j];
                    const aj = Math.abs(sj.diff);
                    if (aj < bestAbs) {
                        bestAbs = aj;
                        bestTs = sj.ts;
                    }
                }

                for (let j = 0; j < samples.length - 1; j++) {
                    const s0 = samples[j];
                    const s1 = samples[j + 1];
                    if (!(s0.diff === 0 || s1.diff === 0 || s0.diff * s1.diff <= 0)) continue;
                    const mid = (s0.ts + s1.ts) * 0.5;
                    const dist = Math.abs(mid - tGuess);
                    if (dist > bestBracketDist) continue;
                    bestBracketDist = dist;
                    loTs = s0.ts;
                    hiTs = s1.ts;
                    loD = s0.diff;
                    hiD = s1.diff;
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
                } else if (bestAbs > ROOT_MAX_ERR_DEG) {
                    continue;
                }

                const final = diffAtTs(t);
                if (!final) continue;
                if (Math.abs(final.diff) > ROOT_MAX_ERR_DEG) continue;
                const segTs = b.ts - a.ts;
                if (segTs <= 0) continue;
                if (Math.abs(t - tGuess) > segTs * ROOT_MAX_TS_DRIFT_FACTOR) continue;
                const uRoot = Math.max(0, Math.min(1, (t - a.ts) / segTs));
                const expectedOrbit = a.orbit + (b.orbit - a.orbit) * uRoot;
                if (Math.abs(final.inst.orbit - expectedOrbit) > ROOT_MAX_ORBIT_DRIFT) continue;

                pushUnique({
                    ts: t,
                    index: si,
                    code: spokeCode,
                    azimuthDeg: final.inst.azimuthDeg,
                    altitudeDeg: final.inst.altitudeDeg,
                    angleDeg: spokeBase,
                    orbit: final.inst.orbit,
                    visible: final.inst.visible,
                    source: 'spoke',
                    tags: cycleSpokeTags('compass', spokeCode),
                    sourceWheel: opts.sourceWheel ?? 'horizon',
                    meta: {
                        altitudeDeg: final.inst.altitudeDeg,
                        azimuthDeg: final.inst.azimuthDeg,
                        orbit: final.inst.orbit,
                        raHours: final.inst.raHours,
                        decDeg: final.inst.decDeg,
                        distanceAu: final.inst.distanceAu,
                        distanceKm: final.inst.distanceKm
                    }
                });
            }
        }
    }

    return out;
}

function findCompassCycleWindow(opts: {
    looker: ObjId;
    target: ObjId;
    location: WheelInput['location'];
    ts: number;
}): { startTs: number; endTs: number } | null {
    const { looker, target, location, ts } = opts;
    if (!location) return null;

    const windowHoursList = [36, 72];
    for (const windowHours of windowHoursList) {
        const baseTrack = buildTrackFromInstantSamplesCentered({
            looker,
            target,
            location,
            ts,
            windowHours,
            stepMinutes: 30,
            sourceWheel: 'compass'
        });
        const spokeTrack = computeSpokeIntersectionsCompass({
            looker,
            target,
            location,
            baseTrack,
            sourceWheel: 'compass'
        });
        const ePoints = spokeTrack
            .filter((p) => p.code === 'E' && Number.isFinite(p.ts))
            .slice()
            .sort((a, b) => a.ts - b.ts);
        if (!ePoints.length) continue;
        const prev = ePoints.filter((p) => p.ts <= ts).slice(-1)[0];
        const next = ePoints.find((p) => p.ts > ts);
        if (prev && next) return { startTs: prev.ts, endTs: next.ts };
    }

    return null;
}

function buildCompassCycleWithoutHorizon(opts: {
    looker: ObjId;
    target: ObjId;
    location: WheelInput['location'];
    ts: number;
}): { baseTrack: CompassTrackPoint[] | undefined; spokeTrack: CompassTrackPoint[] } | null {
    const { looker, target, location, ts } = opts;
    if (!location) return null;

    const window = findCompassCycleWindow({ looker, target, location, ts });
    if (!window) return null;

    const baseTrack = buildTrackFromInstantSamples({
        looker,
        target,
        location,
        fromTs: window.startTs,
        toTs: window.endTs,
        stepMinutes: 30,
        sourceWheel: 'compass'
    });

    const spokeTrack = computeSpokeIntersectionsCompass({
        looker,
        target,
        location,
        baseTrack,
        sourceWheel: 'compass'
    });

    const startInst = computeHorizonInstant({ ts: window.startTs, looker, target, location });
    if (startInst) {
        spokeTrack.push({
            ts: window.startTs,
            index: 0,
            code: 'E',
            azimuthDeg: startInst.azimuthDeg,
            altitudeDeg: startInst.altitudeDeg,
            angleDeg: spokeAngleByIndex(0),
            orbit: startInst.orbit,
            visible: startInst.visible,
            source: 'spoke',
            tags: cycleSpokeTags('compass', 'E'),
            sourceWheel: 'compass',
            meta: {
                altitudeDeg: startInst.altitudeDeg,
                azimuthDeg: startInst.azimuthDeg,
                orbit: startInst.orbit,
                raHours: startInst.raHours,
                decDeg: startInst.decDeg,
                distanceAu: startInst.distanceAu,
                distanceKm: startInst.distanceKm
            }
        });
    }

    const endInst = computeHorizonInstant({ ts: window.endTs, looker, target, location });
    if (endInst) {
        spokeTrack.push({
            ts: window.endTs,
            index: COMPASS_SPOKES.length,
            code: 'E_next',
            azimuthDeg: endInst.azimuthDeg,
            altitudeDeg: endInst.altitudeDeg,
            angleDeg: spokeAngleByIndex(0),
            orbit: endInst.orbit,
            visible: endInst.visible,
            source: 'spoke',
            tags: cycleSpokeTags('compass', 'E_next'),
            sourceWheel: 'compass',
            meta: {
                altitudeDeg: endInst.altitudeDeg,
                azimuthDeg: endInst.azimuthDeg,
                orbit: endInst.orbit,
                raHours: endInst.raHours,
                decDeg: endInst.decDeg,
                distanceAu: endInst.distanceAu,
                distanceKm: endInst.distanceKm
            }
        });
    }

    return { baseTrack, spokeTrack };
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

    const mainCycle = compassSpec.mainCycle;
    const mainStartTag = `E-${mainCycle}`;
    const mainEndTag = `E_next-${mainCycle}`;

    const compassNodeTags = Array.isArray(compassSpec.nodes?.compass) ? compassSpec.nodes.compass : [];
    const horizonNodeTags = Array.isArray(compassSpec.nodes?.horizon) ? compassSpec.nodes.horizon : [];
    const pointGroup = (x: CompassTrackPoint): 'main' | 'compass' | 'horizon' | 'regular' => {
        const tags = Array.isArray(x.tags) ? x.tags : [];
        if (tags.includes(mainStartTag) || tags.includes(mainEndTag)) return 'main';
        if (compassNodeTags.some((tag) => tags.includes(tag))) return 'compass';
        if (horizonNodeTags.some((tag) => tags.includes(tag))) return 'horizon';
        return 'regular';
    };

    for (const p of sorted) {
        const pGroup = pointGroup(p);
        const hitIdx = merged.findIndex((m) =>
            pointGroup(m) === pGroup &&
            Math.abs(m.ts - p.ts) <= TS_EPS &&
            angDist(m.angleDeg, p.angleDeg) <= ANG_EPS &&
            Math.abs(m.orbit - p.orbit) <= ORBIT_EPS
        );

        if (hitIdx < 0) {
            merged.push(p);
            continue;
        }

        const prev = merged[hitIdx];
        const mergedTags = uniqueTags([...(prev.tags ?? []), ...(p.tags ?? [])]);
        const prevBoundary = pointGroup(prev) === 'main';
        const pBoundary = pGroup === 'main';

        if (prevBoundary || pBoundary) {
            if (pBoundary && !prevBoundary) {
                merged[hitIdx] = { ...p, tags: mergedTags.length ? mergedTags : p.tags };
            } else {
                merged[hitIdx] = { ...prev, tags: mergedTags.length ? mergedTags : prev.tags };
            }
            continue;
        }

        merged[hitIdx] = { ...prev, tags: mergedTags.length ? mergedTags : prev.tags };
    }

    return merged.sort((a, b) => a.ts - b.ts);
}

function applyCompassBoundaryCycleTags(
    track: CompassTrackPoint[] | undefined,
    mode: 'horizon' | 'compass'
): CompassTrackPoint[] | undefined {
    if (!track?.length) return track;

    const startTag = mode === 'horizon' ? 'E-horizon' : 'E-compass';
    const endTag = mode === 'horizon' ? 'E_next-horizon' : 'E_next-compass';

    return track.map((p) => {
        const tags = uniqueTags(Array.isArray(p.tags) ? p.tags : []);
        if (tags.includes(startTag)) {
            tags.push('cycle start');
        }
        if (tags.includes(endTag)) {
            tags.push('cycle end');
        }
        const nextTags = uniqueTags(tags);
        return {
            ...p,
            tags: nextTags.length ? nextTags : undefined
        };
    });
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

            const visibility = classifyHorizonVisibility({
                target: id,
                location: loc,
                ts,
                looker
            });

            const hasHorizonCycle = visibility.status === 'crosses' || visibility.status === 'unknown';
            const horizonSpokes = hasHorizonCycle ? await resolveHorizonSpokesForTarget(input, id) : undefined;

            let baseTrack: CompassTrackPoint[] | undefined;
            let spokeTrack: CompassTrackPoint[] = [];
            let mainCycle: 'horizon' | 'compass' = compassSpec.mainCycle;

            if (hasHorizonCycle) {
                baseTrack = buildTrackFromHorizonSpokes(horizonSpokes);
                spokeTrack = computeSpokeIntersectionsCompass({
                    looker,
                    target: id,
                    location: loc,
                    baseTrack,
                    sourceWheel: 'horizon'
                });
            } else {
                const noHorizon = buildCompassCycleWithoutHorizon({
                    looker,
                    target: id,
                    location: loc,
                    ts
                });
                if (noHorizon) {
                    baseTrack = noHorizon.baseTrack;
                    spokeTrack = noHorizon.spokeTrack;
                    mainCycle = 'compass';
                } else {
                    baseTrack = buildTrackFromInstantSamplesCentered({
                        looker,
                        target: id,
                        location: loc,
                        ts,
                        windowHours: 24,
                        stepMinutes: 30,
                        sourceWheel: 'compass'
                    });
                    spokeTrack = computeSpokeIntersectionsCompass({
                        looker,
                        target: id,
                        location: loc,
                        baseTrack,
                        sourceWheel: 'compass'
                    });
                    mainCycle = 'compass';
                    dbg?.warn?.('compass.noHorizon.windowFallback', { id, ts });
                }
            }
            const orbitTrackRaw = mergeTrackPointsPreferSpokes([...(baseTrack ?? []), ...spokeTrack]);
            const orbitTrackTagged = applyCompassBoundaryCycleTags(
                orbitTrackRaw,
                hasHorizonCycle ? 'horizon' : 'compass'
            );
            const orbitTrack = trackInMainCycleWindow(orbitTrackTagged, mainCycle, ts);
            const currentHouses = {
                horizon: currentHouseAtTs(horizonSpokes, ts),
                compass: currentHouseAtTs(spokeTrack, ts)
            };
            const moonPhase = id === 'Moon'
                ? buildMoonPhaseVisual({ ts, looker, location: loc, moonInstant: instant })
                : null;

            return {
                id,
                azimuthDeg: instant.azimuthDeg,
                altitudeDeg: instant.altitudeDeg,
                angleDeg: azimuthToWheelAngleDeg(instant.azimuthDeg),
                orbit: instant.orbit,
                visible: instant.visible,
                currentHouses,
                orbitTrack,
                infoMeta: {
                    horizon: {
                        altitudeDeg: instant.altitudeDeg,
                        azimuthDeg: instant.azimuthDeg,
                        orbit: instant.orbit,
                        raHours: instant.raHours,
                        decDeg: instant.decDeg,
                        distanceAu: instant.distanceAu,
                        distanceKm: instant.distanceKm
                    }
                },
                raHours: instant.raHours,
                decDeg: instant.decDeg,
                distanceAu: instant.distanceAu,
                distanceLabel: `Dist to ${bodyNameEn(looker)}`,
                moonPhaseEmoji: moonPhase?.emoji,
                moonPhaseName: moonPhase?.name,
                moonPhaseFraction: moonPhase?.fraction,
                moonPhaseRotationDeg: moonPhase?.rotationDeg
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

function norm360Local(deg: number): number {
    const x = deg % 360;
    return x < 0 ? x + 360 : x;
}

type MoonPhaseVisual = {
    emoji: string;
    name: string;
    fraction: number;
    rotationDeg: number;
};

function moonPhaseFromSynodPhaseDeg(phaseDeg: number): { emoji: string; name: string } {
    const p = norm360Local(phaseDeg);
    if (p < 22.5 || p >= 337.5) return { emoji: '🌑', name: 'New Moon' };
    if (p < 67.5) return { emoji: '🌒', name: 'Waxing Crescent' };
    if (p < 112.5) return { emoji: '🌓', name: 'First Quarter' };
    if (p < 157.5) return { emoji: '🌔', name: 'Waxing Gibbous' };
    if (p < 202.5) return { emoji: '🌕', name: 'Full Moon' };
    if (p < 247.5) return { emoji: '🌖', name: 'Waning Gibbous' };
    if (p < 292.5) return { emoji: '🌗', name: 'Last Quarter' };
    return { emoji: '🌘', name: 'Waning Crescent' };
}

function moonGlyphBaseBrightDeg(emoji: string): number {
    if (emoji === '🌖' || emoji === '🌗' || emoji === '🌘') return 180;
    return 0;
}

function buildMoonPhaseVisual(opts: {
    ts: number;
    looker: ObjId;
    location: WheelInput['location'];
    moonInstant: Exclude<ReturnType<typeof computeHorizonInstant>, null>;
}): MoonPhaseVisual | null {
    const { ts, looker, location, moonInstant } = opts;
    if (!location) return null;

    const syn = synodProjectedPhaseAt('Sun', 'Earth', 'Moon', ts);
    const phaseDeg = Number(syn?.phaseDeg);
    if (!Number.isFinite(phaseDeg)) return null;

    const phase = moonPhaseFromSynodPhaseDeg(phaseDeg);
    const phaseRad = (phaseDeg * Math.PI) / 180;
    const fraction = (1 - Math.cos(phaseRad)) / 2;

    const sunInstant = computeHorizonInstant({ ts, looker, target: 'Sun', location });
    if (!sunInstant) {
        return {
            emoji: phase.emoji,
            name: phase.name,
            fraction,
            rotationDeg: 0
        };
    }

    const moonAngleRad = (azimuthToWheelAngleDeg(moonInstant.azimuthDeg) * Math.PI) / 180;
    const sunAngleRad = (azimuthToWheelAngleDeg(sunInstant.azimuthDeg) * Math.PI) / 180;
    const moonX = moonInstant.orbit * Math.cos(moonAngleRad);
    const moonY = moonInstant.orbit * Math.sin(moonAngleRad);
    const sunX = sunInstant.orbit * Math.cos(sunAngleRad);
    const sunY = sunInstant.orbit * Math.sin(sunAngleRad);
    const sunDirDeg = (Math.atan2(sunY - moonY, sunX - moonX) * 180) / Math.PI;
    const rotationDeg = toSigned180(sunDirDeg - moonGlyphBaseBrightDeg(phase.emoji));

    return {
        emoji: phase.emoji,
        name: phase.name,
        fraction,
        rotationDeg
    };
}

function raDecToHorizonPoint(opts: {
    ts: number;
    lat: number;
    lon: number;
    raHours: number;
    decDeg: number;
}): CompassTrackPoint | null {
    const { ts, lat, lon, raHours, decDeg } = opts;
    const time = new AstroTime(new Date(ts));
    const observer = new Observer(lat, lon, 0);
    const hor = Horizon(time, observer, raHours, decDeg, undefined);
    const altitudeDeg = Number(hor.altitude);
    const azimuthDeg = norm360Local(Number(hor.azimuth));
    if (!Number.isFinite(altitudeDeg) || !Number.isFinite(azimuthDeg)) return null;
    return {
        ts,
        index: 0,
        code: 'FRAME',
        azimuthDeg,
        altitudeDeg,
        angleDeg: azimuthToWheelAngleDeg(azimuthDeg),
        orbit: orbitFromAltitudeDeg(altitudeDeg),
        visible: altitudeDeg >= 0,
        source: 'cycle',
        sourceWheel: 'compass',
        meta: {
            raHours,
            decDeg
        }
    };
}

function eclipticLonToRaDecOfDateDeg(
    lonDeg: number,
    time: AstroTime,
    ectToEqdRot: ReturnType<typeof Rotation_ECT_EQD>
): { raDeg: number; decDeg: number } {
    const lonRad = (lonDeg * Math.PI) / 180;
    const eclVec = new Vector(Math.cos(lonRad), Math.sin(lonRad), 0, time);
    const eqdVec = RotateVector(ectToEqdRot, eclVec);
    const x = Number(eqdVec.x);
    const y = Number(eqdVec.y);
    const z = Number(eqdVec.z);
    const rxy = Math.hypot(x, y);
    const raDeg = norm360Local((Math.atan2(y, x) * 180) / Math.PI);
    const decDeg = (Math.atan2(z, rxy) * 180) / Math.PI;
    return { raDeg, decDeg };
}

export function buildCompassAstroFrameLayer(input: {
    ts: number;
    location: WheelInput['location'];
}): CompassAstroFrameLayer | null {
    const ts = Number(input.ts);
    const lat = Number(input.location?.lat);
    const lon = Number(input.location?.lon);
    if (!Number.isFinite(ts) || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    const sampleStepDeg = 2;
    const sampleCount = Math.round(360 / sampleStepDeg);
    const equatorTrack: CompassTrackPoint[] = [];
    const eclipticTrack: CompassTrackPoint[] = [];
    const time = new AstroTime(new Date(ts));
    // ECT (true ecliptic of date) -> EQD (true equator of date).
    const ectToEqdRot = Rotation_ECT_EQD(time);
    const constellationEntries = constellationEntriesFromObjects(objects);

    for (let i = 0; i <= sampleCount; i++) {
        const lonDeg = i * sampleStepDeg;
        const baseTs = ts + i;

        const eqRaHours = norm360Local(lonDeg) / 15;
        const eqPoint = raDecToHorizonPoint({
            ts: baseTs,
            lat,
            lon,
            raHours: eqRaHours,
            decDeg: 0
        });
        if (eqPoint) {
            equatorTrack.push({
                ...eqPoint,
                code: 'EQ',
                index: i
            });
        }

        const ecl = eclipticLonToRaDecOfDateDeg(lonDeg, time, ectToEqdRot);
        const eclPoint = raDecToHorizonPoint({
            ts: baseTs,
            lat,
            lon,
            raHours: ecl.raDeg / 15,
            decDeg: ecl.decDeg
        });
        if (eclPoint) {
            eclipticTrack.push({
                ...eclPoint,
                code: 'EC',
                index: i
            });
        }
    }

    const makeNode = (opts: {
        id: string;
        label: string;
        kind: CompassAstroFrameNodeKind;
        emoji: string;
        color?: string;
        raHours: number;
        decDeg: number;
        constellationAbbr?: string;
        constellationName?: string;
        constellationEmoji?: string;
    }): CompassAstroFrameNode | null => {
        const p = raDecToHorizonPoint({
            ts,
            lat,
            lon,
            raHours: opts.raHours,
            decDeg: opts.decDeg
        });
        if (!p) return null;
        // TODO(constellation-spherical): Re-enable constellation lookup for poles
        // after migrating boundary inclusion to robust spherical geometry.
        const hit = (opts.kind === 'pole' || opts.constellationAbbr || opts.constellationName)
            ? null
            : findConstellationByRaDec({
                raDeg: opts.raHours * 15,
                decDeg: opts.decDeg,
                ts,
                constellations: constellationEntries
            });
        return {
            id: opts.id,
            label: opts.label,
            kind: opts.kind,
            ts,
            azimuthDeg: p.azimuthDeg,
            altitudeDeg: p.altitudeDeg,
            angleDeg: p.angleDeg,
            orbit: p.orbit,
            visible: p.visible,
            emoji: opts.emoji,
            color: opts.color,
            meta: {
                raHours: opts.raHours,
                decDeg: opts.decDeg,
                constellationAbbr: opts.constellationAbbr ?? hit?.abbr,
                constellationName: opts.constellationName ?? hit?.name,
                constellationEmoji: opts.constellationEmoji ?? hit?.emoji
            }
        };
    };

    const nodes: CompassAstroFrameNode[] = [];
    const pushNode = (x: CompassAstroFrameNode | null) => {
        if (x) nodes.push(x);
    };

    const makeEclipticSeasonNode = (opts: {
        id: string;
        label: string;
        lonDeg: number;
        color: string;
    }): CompassAstroFrameNode | null => {
        const ecl = eclipticLonToRaDecOfDateDeg(opts.lonDeg, time, ectToEqdRot);
        const hit = findConstellationByRaDec({
            raDeg: ecl.raDeg,
            decDeg: ecl.decDeg,
            ts,
            constellations: constellationEntries
        });
        return makeNode({
            id: opts.id,
            label: opts.label,
            kind: 'intersection',
            emoji: '✶',
            color: opts.color,
            raHours: ecl.raDeg / 15,
            decDeg: ecl.decDeg,
            constellationAbbr: hit?.abbr,
            constellationName: hit?.name,
            constellationEmoji: hit?.emoji
        });
    };

    // Seasonal anchors on the ecliptic (of-date projection on the current wheel timestamp).
    pushNode(makeEclipticSeasonNode({
        id: 'astro:intersection:vernal',
        label: 'Vernal Equinox',
        lonDeg: 0,
        color: '#ff4d4f'
    }));
    pushNode(makeEclipticSeasonNode({
        id: 'astro:intersection:autumnal',
        label: 'Autumnal Equinox',
        lonDeg: 180,
        color: '#4d7cff'
    }));
    pushNode(makeEclipticSeasonNode({
        id: 'astro:solstice:summer',
        label: 'Summer Solstice',
        lonDeg: 90,
        color: '#ffffff'
    }));
    pushNode(makeEclipticSeasonNode({
        id: 'astro:solstice:winter',
        label: 'Winter Solstice',
        lonDeg: 270,
        color: '#f5c542'
    }));
    pushNode(makeNode({
        id: 'astro:pole:north',
        label: 'North Celestial Pole',
        kind: 'pole',
        emoji: '⬆',
        color: '#bcd3ff',
        raHours: 0,
        decDeg: 90
    }));
    pushNode(makeNode({
        id: 'astro:pole:south',
        label: 'South Celestial Pole',
        kind: 'pole',
        emoji: '⬇',
        color: '#ffc9c9',
        raHours: 0,
        decDeg: -90
    }));

    return {
        curves: [
            {
                id: 'equator',
                label: 'Celestial Equator',
                color: '#4cc9f0',
                track: equatorTrack
            },
            {
                id: 'ecliptic',
                label: 'Ecliptic',
                color: '#d4af37',
                track: eclipticTrack
            }
        ],
        nodes
    };
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
        const emoji = (t.id === 'Moon' && typeof t.moonPhaseEmoji === 'string' && t.moonPhaseEmoji.trim())
            ? t.moonPhaseEmoji.trim()
            : bodyEmoji(t.id);
        const color = bodyColor(t.id);
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
            color,
            emojiRotationDeg: Number.isFinite(t.moonPhaseRotationDeg) ? t.moonPhaseRotationDeg : undefined,

            title: name,
            description: t.visible
                ? `Alt ${t.altitudeDeg.toFixed(1)}°, Az ${t.azimuthDeg.toFixed(1)}°`
                : `Below horizon (${t.altitudeDeg.toFixed(1)}°)`,

            opacity: t.visible ? 1 : 0.6
        };
    });
}
