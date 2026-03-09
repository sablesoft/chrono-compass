// src/lib/math/horizon.ts
//
// Horizon wheel solver (cycle wheel, topocentric).
//
// Idea (generalizing diurnal.ts from Sun to any target that crosses the horizon):
// - Define horizon crossing when altitude(center) = 0° (geometric horizon, no refraction).
// - Build cycle frame around ts using neighboring RISINGS:
//     E      = last rising (alt crosses 0 from - to +) at/before ts
//     E_next = next rising after ts such that E <= ts < E_next
//     W      = first setting (alt crosses 0 from + to -) inside (E, E_next)
//     N      = max altitude on [E, W]
//     S      = min altitude on [W, E_next]
// - Then build 17 spokes by time-linear interpolation across quarters:
//     E -> N -> W -> S -> E_next
//
// Notes:
// - “grazing” (touch without sign-change) is ignored (strict sign-change crossing).
// - Polar/rare regimes are handled by searching many days forward/backward.
// - We assume the host already validated that the selected target *does* cross the horizon
//   for this looker/location pair; still, numerical failure is possible -> ok:false.
//
// Performance guard:
// - We add an altitude cache (1-second buckets) and a call budget.
// - We also add a “radar” pass (2-hour step) per day to detect sign-change candidates,
//   and only then run the fine solver (10/5/2/1 min + binary refine) inside a small window.
//   This preserves long cycles (years) but prevents freezing when crossings are extremely rare.

import {
    AstroTime,
    Body as EngineBody,
    Equator,
    Horizon,
    Observer,
} from 'astronomy-engine';

import type { Obj, ObjId, ReferenceMeta } from '../catalog';
import { objects } from '../catalog';
import { cycleSpokeTags } from '../catalog/tags';
import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import { SPOKES_ORDER } from '../wheel/types';
import {AU_KM, clamp, lerp, norm360} from './helpers';
import type { Location } from '../location/types';
import { normalize3, refUnit } from './vector';

const DAY_MS = 86_400_000;

// geometric center crossing
const TARGET_ALT_DEG = 0;

// how far we’re willing to search for crossings in pathological (polar/rare) cases
const SEARCH_LIMIT_DAYS = 900; // for Mars and Venus

// filter for “too short” day/night phases near grazing boundaries
const MIN_PHASE_MS = 60_000; // 1 minute

class BudgetError extends Error {
    constructor(msg: string) {
        super(msg);
        this.name = 'BudgetError';
    }
}

export type HorizonMeta = {
    altitudeDeg: number;  // [-90..+90]
    azimuthDeg: number;   // [0..360)
    orbit: number;        // [0..2], derived from altitude
    raHours?: number;
    decDeg?: number;
    distanceAu?: number;
    distanceKm?: number;
};

export type HorizonInstantState = {
    altitudeDeg: number;
    azimuthDeg: number;
    orbit: number;
    visible: boolean;
    raHours?: number;
    decDeg?: number;
    distanceAu?: number;
    distanceKm?: number;
};

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

function isFiniteTs(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function isFiniteNumber(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function toEngineBody(id: ObjId): EngineBody {
    return EngineBody[id as keyof typeof EngineBody];
}

function makeObserver(lat: number, lon: number, heightMeters = 0) {
    return new Observer(lat, lon, heightMeters);
}

/**
 * Compute (alt, az, eq) for target at time ts for a topocentric observer.
 * Refraction is DISABLED (geometric horizon).
 */
function referenceRaDecDeg(id: ObjId): { raDeg: number; decDeg: number } | null {
    const obj = (objects as any)[id] as Obj | undefined;
    if (!obj || obj.kind !== 'reference') return null;
    const meta = obj.meta as ReferenceMeta | undefined;
    const dir = meta?.direction as any;
    if (!dir || dir.frame !== 'icrf_j2000') return null;

    const raDec = dir.raDecDeg as { ra: number; dec: number } | undefined;
    if (raDec && isFiniteNumber(raDec.ra) && isFiniteNumber(raDec.dec)) {
        return { raDeg: norm360(raDec.ra), decDeg: raDec.dec };
    }

    if (dir.unit) {
        const u0 = normalize3(dir.unit);
        if (!u0) return null;
        const raDeg = norm360(Math.atan2(u0[1], u0[0]) * 180 / Math.PI);
        const decDeg = Math.asin(u0[2]) * 180 / Math.PI;
        if (!isFiniteNumber(raDeg) || !isFiniteNumber(decDeg)) return null;
        return { raDeg, decDeg };
    }

    const unit = meta ? refUnit(meta) : null;
    if (!unit) return null;
    const raDeg = norm360(Math.atan2(unit[1], unit[0]) * 180 / Math.PI);
    const decDeg = Math.asin(unit[2]) * 180 / Math.PI;
    if (!isFiniteNumber(raDeg) || !isFiniteNumber(decDeg)) return null;
    return { raDeg, decDeg };
}

function targetState(ts: number, obs: Observer, target: ObjId): {
    altDeg: number;
    azDeg: number;
    raHours: number;
    decDeg: number;
    distAu: number;
} | null {
    try {
        const time = new AstroTime(new Date(ts));
        const obj = (objects as any)[target] as Obj | undefined;

        if (obj?.kind === 'reference') {
            const ref = referenceRaDecDeg(target);
            if (!ref) return null;
            const raHours = ref.raDeg / 15;
            const decDeg = ref.decDeg;
            const hor = Horizon(time, obs, raHours, decDeg, undefined);

            const alt = clamp(hor.altitude, -90, 90);
            const az = norm360(hor.azimuth);

            if (!isFiniteNumber(alt) || !isFiniteNumber(az)) return null;

            return {
                altDeg: alt,
                azDeg: az,
                raHours,
                decDeg,
                distAu: NaN,
            };
        }

        const body = toEngineBody(target);

        // (ofDate=true, aberration=true) matches compass.ts usage
        const eq = Equator(body, time, obs, true, true);

        // refraction: undefined => geometric
        const hor = Horizon(time, obs, eq.ra, eq.dec, undefined);

        const alt = clamp(hor.altitude, -90, 90);
        const az = norm360(hor.azimuth);

        if (!isFiniteNumber(alt) || !isFiniteNumber(az) || !isFiniteNumber(eq.ra) || !isFiniteNumber(eq.dec)) {
            return null;
        }

        return {
            altDeg: alt,
            azDeg: az,
            raHours: eq.ra,
            decDeg: eq.dec,
            distAu: eq.dist,
        };
    } catch {
        return null;
    }
}

function targetAltitudeDeg(ts: number, obs: Observer, target: ObjId): number {
    const s = targetState(ts, obs, target);
    return s ? s.altDeg : NaN;
}

export type HorizonVisibility = 'crosses' | 'alwaysAbove' | 'alwaysBelow' | 'unknown';

function referenceDeclinationDeg(id: ObjId): number | null {
    const obj = (objects as any)[id] as { kind?: string; meta?: ReferenceMeta } | undefined;
    if (!obj || obj.kind !== 'reference') return null;
    const meta = obj.meta;
    const dir = meta?.direction as any;
    if (!dir || dir.frame !== 'icrf_j2000') return null;

    const raDec = dir.raDecDeg as { ra: number; dec: number } | undefined;
    if (raDec && isFiniteNumber(raDec.dec) && raDec.dec >= -90 && raDec.dec <= 90) {
        return raDec.dec;
    }

    if (dir.unit) {
        const u0 = normalize3(dir.unit);
        if (!u0) return null;
        const dec = Math.asin(u0[2]) * 180 / Math.PI;
        if (!isFiniteNumber(dec)) return null;
        return dec;
    }

    const unit = meta ? refUnit(meta) : null;
    if (!unit) return null;
    const dec = Math.asin(unit[2]) * 180 / Math.PI;
    if (!isFiniteNumber(dec)) return null;
    return dec;
}

function classifyByDeclination(latDeg: number, decDeg: number): { status: HorizonVisibility; minAlt: number; maxAlt: number } {
    const maxAlt = 90 - Math.abs(latDeg - decDeg);
    const minAlt = -90 + Math.abs(latDeg + decDeg);
    if (minAlt >= 0) return { status: 'alwaysAbove', minAlt, maxAlt };
    if (maxAlt <= 0) return { status: 'alwaysBelow', minAlt, maxAlt };
    return { status: 'crosses', minAlt, maxAlt };
}

export function classifyHorizonVisibility(opts: {
    target: ObjId;
    location: Pick<Location, 'lat' | 'lon'>;
    ts: number;
    looker?: ObjId;
    scanHours?: number;
    scanStepMinutes?: number;
}): { status: HorizonVisibility; minAlt?: number; maxAlt?: number; decDeg?: number; reason?: string } {
    const looker = (opts.looker ?? 'Earth') as ObjId;
    if (looker !== 'Earth') return { status: 'unknown', reason: 'looker not supported' };

    const lat = Number(opts.location?.lat);
    if (!isFiniteNumber(lat)) return { status: 'unknown', reason: 'invalid location' };

    const dec = referenceDeclinationDeg(opts.target);
    if (isFiniteNumber(dec)) {
        const res = classifyByDeclination(lat, dec as number);
        return { status: res.status, minAlt: res.minAlt, maxAlt: res.maxAlt, decDeg: dec as number };
    }

    const obs = makeObserver(opts.location.lat, opts.location.lon, 0);
    const spanHours = Number.isFinite(opts.scanHours) ? Math.max(1, opts.scanHours as number) : 24;
    const stepMin = Number.isFinite(opts.scanStepMinutes) ? Math.max(5, opts.scanStepMinutes as number) : 120;
    const stepMs = stepMin * 60_000;
    const halfMs = (spanHours * 60 * 60_000) / 2;
    const t0 = opts.ts - halfMs;
    const t1 = opts.ts + halfMs;

    let minAlt = Number.POSITIVE_INFINITY;
    let maxAlt = Number.NEGATIVE_INFINITY;
    let samples = 0;

    for (let t = t0; t <= t1 + 1; t += stepMs) {
        const alt = targetAltitudeDeg(t, obs, opts.target);
        if (!isFiniteNumber(alt)) continue;
        samples++;
        if (alt < minAlt) minAlt = alt;
        if (alt > maxAlt) maxAlt = alt;
    }

    if (samples === 0) return { status: 'unknown', reason: 'no samples' };
    if (minAlt >= 0) return { status: 'alwaysAbove', minAlt, maxAlt };
    if (maxAlt <= 0) return { status: 'alwaysBelow', minAlt, maxAlt };
    return { status: 'crosses', minAlt, maxAlt };
}

export function orbitFromAltitudeDeg(altitudeDeg: number): number {
    const alt = clamp(altitudeDeg, -90, 90);
    return alt >= 0
        ? (90 - alt) / 90
        : 1 + (-alt) / 90;
}

export function computeHorizonInstant(opts: {
    ts: number;
    looker?: ObjId;
    target: ObjId;
    location: Pick<Location, 'lat' | 'lon'>;
}): HorizonInstantState | null {
    const looker = (opts.looker ?? 'Earth') as ObjId;
    if (looker !== 'Earth') return null;

    const obs = makeObserver(opts.location.lat, opts.location.lon, 0);
    const st = targetState(opts.ts, obs, opts.target);
    if (!st) return null;

    const distanceKm = isFiniteNumber(st.distAu) ? st.distAu * AU_KM : undefined;
    return {
        altitudeDeg: st.altDeg,
        azimuthDeg: st.azDeg,
        orbit: orbitFromAltitudeDeg(st.altDeg),
        visible: st.altDeg >= 0,
        raHours: st.raHours,
        decDeg: st.decDeg,
        distanceAu: st.distAu,
        distanceKm
    };
}

type AltProvider = {
    altAt: (t: number) => number;
    calls: () => number;
};

/**
 * Cached & budgeted altitude provider.
 * - caches by 1-second buckets (massive win for searches)
 * - enforces a call budget to avoid UI freeze
 */
function makeAltProvider(obs: Observer, target: ObjId, dbg?: WheelInput['dbg']): AltProvider {
    const cache = new Map<number, number>();
    let calls = 0;

    // With radar + cache this should be plenty, even for multi-year searches.
    // If you see budget hits for legitimate cases, bump it (but prefer adding a Worker later).
    const MAX_CALLS = 250_000;

    const altAt = (t: number) => {
        const key = Math.round(t / 1000) * 1000; // 1s bucket
        const cached = cache.get(key);
        if (cached !== undefined) return cached;

        calls++;
        if (calls > MAX_CALLS) {
            dbg?.warn?.('horizon.budgetExceeded', { calls, MAX_CALLS, target, t: fmt(t) });
            throw new BudgetError(`Horizon: altitude budget exceeded (${MAX_CALLS})`);
        }

        const v = targetAltitudeDeg(key, obs, target);
        cache.set(key, v);
        return v;
    };

    return { altAt, calls: () => calls };
}

function findExtremumMs(opts: {
    t0: number;
    t1: number;
    altAt: (t: number) => number;
    kind: 'max' | 'min';
    coarseStepMs?: number;
    refineIters?: number;
}): number | null {
    const { t0, t1, altAt, kind, coarseStepMs = 10 * 60_000, refineIters = 50 } = opts;
    if (!(t1 > t0)) return null;

    let bestT = t0;
    let bestV = altAt(t0);
    if (!Number.isFinite(bestV)) return null;

    for (let t = t0; t <= t1; t += coarseStepMs) {
        const v = altAt(t);
        if (!Number.isFinite(v)) continue;
        const better = kind === 'max' ? v > bestV : v < bestV;
        if (better) {
            bestV = v;
            bestT = t;
        }
    }

    let lo = Math.max(t0, bestT - coarseStepMs);
    let hi = Math.min(t1, bestT + coarseStepMs);

    for (let i = 0; i < refineIters; i++) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        const v1 = altAt(m1);
        const v2 = altAt(m2);
        if (!Number.isFinite(v1) || !Number.isFinite(v2)) break;

        if (kind === 'max') {
            if (v1 < v2) lo = m1;
            else hi = m2;
        } else {
            if (v1 > v2) lo = m1;
            else hi = m2;
        }
    }

    return (lo + hi) / 2;
}

/**
 * Strictly finds a sign-change crossing of altitude(t) = targetAltDeg on [t0, t1].
 * Grazing (touching without sign change) is ignored.
 *
 * rising=true:  - -> +
 * rising=false: + -> -
 *
 * mode:
 *  - "first": first crossing in window
 *  - "last":  last crossing in window
 */
function findAltitudeCrossingMs(opts: {
    t0: number;
    t1: number;
    altAt: (t: number) => number;
    targetAltDeg: number;
    rising: boolean;
    mode: 'first' | 'last';
    coarseStepMs?: number;
    refineEpsMs?: number;
}): number | null {
    const {
        t0,
        t1,
        altAt,
        targetAltDeg,
        rising,
        mode,
        coarseStepMs = 10 * 60_000,
        refineEpsMs = 1000,
    } = opts;

    const f = (t: number) => altAt(t) - targetAltDeg;

    let prevT = t0;
    let prevF = f(prevT);
    if (!Number.isFinite(prevF)) return null;

    let found: number | null = null;

    for (let t = t0 + coarseStepMs; t <= t1; t += coarseStepMs) {
        const curT = t;
        const curF = f(curT);
        if (!Number.isFinite(curF)) return null;

        const crosses = rising
            ? (prevF < 0 && curF >= 0) || (prevF <= 0 && curF > 0)
            : (prevF > 0 && curF <= 0) || (prevF >= 0 && curF < 0);

        if (crosses) {
            let lo = prevT;
            let hi = curT;

            const flo = prevF;
            const fhi = curF;

            // ensure a bracket; if not, it was numerical weirdness / grazing-on-zero
            if (!(Number.isFinite(flo) && Number.isFinite(fhi))) return null;
            if (Math.sign(flo) === Math.sign(fhi) && flo !== 0 && fhi !== 0) {
                prevT = curT;
                prevF = curF;
                continue;
            }

            while (hi - lo > refineEpsMs) {
                const mid = (lo + hi) / 2;
                const fmid = f(mid);
                if (!Number.isFinite(fmid)) return null;

                if (rising) {
                    if (fmid >= 0) hi = mid;
                    else lo = mid;
                } else {
                    if (fmid <= 0) hi = mid;
                    else lo = mid;
                }
            }

            const hit = hi;
            if (mode === 'first') return hit;
            found = hit;
        }

        prevT = curT;
        prevF = curF;
    }

    return found;
}

/**
 * Day-level helper:
 * 1) "Radar" scan with a large step to see if a sign change is plausible in [t0,t1].
 * 2) If yes, do the fine solve only inside that small bracket.
 */
function findCrossingInDay(opts: {
    t0: number;
    t1: number;
    altAt: (t: number) => number;
    targetAltDeg: number;
    rising: boolean;
    mode: 'first' | 'last';
}): number | null {
    const { t0, t1, altAt, targetAltDeg, rising, mode } = opts;

    const RADAR_STEP = 2 * 3600_000; // 2 hours

    let prevT = t0;
    let prevF = altAt(prevT) - targetAltDeg;
    if (!Number.isFinite(prevF)) return null;

    let candidate: { a: number; b: number } | null = null;

    for (let t = t0 + RADAR_STEP; t <= t1; t += RADAR_STEP) {
        const curT = t;
        const curF = altAt(curT) - targetAltDeg;
        if (!Number.isFinite(curF)) return null;

        const crosses = rising
            ? (prevF < 0 && curF >= 0) || (prevF <= 0 && curF > 0)
            : (prevF > 0 && curF <= 0) || (prevF >= 0 && curF < 0);

        if (crosses) {
            candidate = { a: prevT, b: curT };
            if (mode === 'first') break;
        }

        prevT = curT;
        prevF = curF;
    }

    if (!candidate) return null;

    const steps = [10 * 60_000, 5 * 60_000, 2 * 60_000, 60_000];

    for (const coarseStepMs of steps) {
        const hit = findAltitudeCrossingMs({
            t0: candidate.a,
            t1: candidate.b,
            altAt,
            targetAltDeg,
            rising,
            mode, // preserve requested direction ("first"/"last")
            coarseStepMs,
            refineEpsMs: 1000,
        });
        if (isFiniteTs(hit)) return hit;
    }

    return null;
}

type RiseSetCycle = {
    E: number;        // rising crossing
    W: number;        // setting crossing
    E_next: number;   // next rising crossing
    N: number;        // max altitude on [E,W]
    S: number;        // min altitude on [W,E_next]
};

function findNextCrossing(
    tStart: number,
    altAt: (t: number) => number,
    rising: boolean,
): number | null {
    for (let dayOffset = 0; dayOffset <= SEARCH_LIMIT_DAYS; dayOffset++) {
        const t0 = tStart + dayOffset * DAY_MS;
        const t1 = t0 + DAY_MS;

        const hit = findCrossingInDay({
            t0,
            t1,
            altAt,
            targetAltDeg: TARGET_ALT_DEG,
            rising,
            mode: 'first',
        });

        if (isFiniteTs(hit)) return hit;
    }
    return null;
}

function findPrevCrossing(
    tEnd: number,
    altAt: (t: number) => number,
    rising: boolean,
): number | null {
    for (let dayOffset = 0; dayOffset <= SEARCH_LIMIT_DAYS; dayOffset++) {
        const t1 = tEnd - dayOffset * DAY_MS;
        const t0 = t1 - DAY_MS;

        const hit = findCrossingInDay({
            t0,
            t1,
            altAt,
            targetAltDeg: TARGET_ALT_DEG,
            rising,
            mode: 'last',
        });

        if (isFiniteTs(hit)) return hit;
    }
    return null;
}

function computeCycleAroundTs(ts: number, obs: Observer, target: ObjId, dbg?: WheelInput['dbg']): RiseSetCycle | null {
    const { altAt, calls } = makeAltProvider(obs, target, dbg);

    // 1) E = last rising at/before ts
    let E = findPrevCrossing(ts, altAt, true);
    if (!isFiniteTs(E)) return null;

    // 2) E_next = next rising after ts (not after E!)
    let E_next = findNextCrossing(ts + 1, altAt, true);
    if (!isFiniteTs(E_next)) return null;

    if (E_next <= E) {
        E_next = findNextCrossing(E + 1, altAt, true);
        if (!isFiniteTs(E_next) || E_next <= E) return null;
    }

    // if the frame collapsed (boundary grime), push E_next forward a bit
    let safety = 0;
    while (E_next - E < MIN_PHASE_MS && safety++ < 5) {
        const next = findNextCrossing(E_next + 1, altAt, true);
        if (!isFiniteTs(next)) break;
        E_next = next;
    }

    // 3) W = first setting strictly inside [E, E_next]
    const W = findAltitudeCrossingMs({
        t0: E,
        t1: E_next,
        altAt,
        targetAltDeg: TARGET_ALT_DEG,
        rising: false,
        mode: 'first',
        coarseStepMs: 10 * 60_000,
        refineEpsMs: 1000,
    });

    if (!isFiniteTs(W)) return null;

    const dayLen = W - E;
    const nightLen = E_next - W;

    // local bump strategy (same spirit as diurnal.ts)
    if (dayLen < MIN_PHASE_MS) {
        const bumped = Math.min(E_next - 1, ts + MIN_PHASE_MS);
        return computeCycleAroundTs(bumped, obs, target, dbg);
    }
    if (nightLen < MIN_PHASE_MS) {
        const bumped = Math.max(E + 1, ts - MIN_PHASE_MS);
        return computeCycleAroundTs(bumped, obs, target, dbg);
    }

    // 4) N and S as extrema on halves (uses cached/budgeted altitude)
    const N = findExtremumMs({ t0: E, t1: W, altAt, kind: 'max' });
    const S = findExtremumMs({ t0: W, t1: E_next, altAt, kind: 'min' });
    if (!isFiniteTs(N) || !isFiniteTs(S)) return null;

    dbg?.log?.('horizon.cycle', {
        ts: fmt(ts),
        target,
        E: fmt(E),
        N: fmt(N),
        W: fmt(W),
        S: fmt(S),
        E_next: fmt(E_next),
        dayLenH: (dayLen / 3_600_000).toFixed(3),
        nightLenH: (nightLen / 3_600_000).toFixed(3),
        altCalls: calls(),
    });

    return { E, W, E_next, N, S };
}

function mkSpoke(index: number, ts: number, obs: Observer, target: ObjId): CycleSpoke<HorizonMeta> {
    const code = SPOKES_ORDER[index] ?? (index === 16 ? 'E_next' : 'E');
    const st = targetState(ts, obs, target);

    const alt = st ? st.altDeg : NaN;
    const az = st ? st.azDeg : NaN;

    const distAu = st?.distAu;
    const distKm = isFiniteNumber(distAu) ? distAu * AU_KM : undefined;

    return {
        ts,
        code,
        index,
        tags: [],
        meta: {
            altitudeDeg: isFiniteNumber(alt) ? alt : NaN,
            azimuthDeg: isFiniteNumber(az) ? az : NaN,
            orbit: isFiniteNumber(alt) ? orbitFromAltitudeDeg(alt) : NaN,
            raHours: st?.raHours,
            decDeg: st?.decDeg,
            distanceAu: distAu,
            distanceKm: distKm,
        },
    };
}

/**
 * Finds t in [t0, t1] such that altitude(t) ~= targetAltDeg.
 * Requires that targetAltDeg is bracketed by altitude at endpoints (sign change in f).
 * Uses bisection to refine.
 *
 * refineEpsMs: precision of result in milliseconds.
 * For "minute precision", use 60_000.
 */
function findTimeAtAltitudeMs(opts: {
    t0: number;
    t1: number;
    altAt: (t: number) => number;
    targetAltDeg: number;
    refineEpsMs?: number;
}): number | null {
    const { t0, t1, altAt, targetAltDeg, refineEpsMs = 60_000 } = opts;

    if (!(t1 > t0)) return null;

    const f = (t: number) => altAt(t) - targetAltDeg;

    let lo = t0;
    let hi = t1;

    let flo = f(lo);
    let fhi = f(hi);

    if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return null;

    // exact hits
    if (flo === 0) return lo;
    if (fhi === 0) return hi;

    // must bracket the root
    if (Math.sign(flo) === Math.sign(fhi)) return null;

    while (hi - lo > refineEpsMs) {
        const mid = (lo + hi) / 2;
        const fmid = f(mid);
        if (!Number.isFinite(fmid)) return null;

        if (fmid === 0) return mid;

        // keep the bracket
        if (Math.sign(fmid) === Math.sign(flo)) {
            lo = mid;
            flo = fmid;
        } else {
            hi = mid;
            fhi = fmid;
        }
    }

    // minute-ish precision: return midpoint, optionally bucket to minute
    const t = (lo + hi) / 2;

    // If you want strict minute buckets (optional), uncomment:
    // return Math.round(t / 60_000) * 60_000;

    return t;
}

export function solveHorizonWheel(input: WheelInput<'horizon'>): CycleSolveResult<HorizonMeta> {
    const dbg = input.dbg;

    const fail = (reason: string): CycleSolveResult<HorizonMeta> => ({
        ok: false,
        kind: 'cycle',
        ts: input.ts,
        reason,
        spokes: [],
    });

    const ts = input.ts;

    const loc = input.location;
    if (!loc) return fail('Horizon wheel requires location (input.location is missing).');

    const looker = (input.looker ?? 'Earth') as ObjId;
    if (looker !== 'Earth') {
        return fail(`Horizon: topocentric horizon supported only for looker=Earth (got ${String(looker)}).`);
    }

    const rawTarget = input.target;
    const target: ObjId | null = Array.isArray(rawTarget) ? (rawTarget[0] ?? null) : (rawTarget ?? null);
    if (!target) return fail('Horizon wheel requires target.');

    const obs = makeObserver(loc.lat, loc.lon, 0);

    dbg?.log?.('horizon.in', { ts: fmt(ts), looker, target, loc });

    let cycle: RiseSetCycle | null = null;
    try {
        cycle = computeCycleAroundTs(ts, obs, target, dbg);
    } catch (e: any) {
        if (e instanceof BudgetError) {
            return fail(`${e.message} (target=${String(target)} lat=${loc.lat} lon=${loc.lon})`);
        }
        // unknown error: keep it visible to caller logs
        dbg?.error?.('horizon.compute.error', { err: e, target, loc, ts: fmt(ts) });
        return fail(`Horizon: unexpected error while computing cycle (target=${String(target)}).`);
    }

    if (!cycle) {
        return fail(
            `Horizon: failed to compute cycle around ts for target=${String(target)} at lat=${loc.lat}, lon=${loc.lon}.`
        );
    }

    const { E, N, W, S, E_next } = cycle;

    // sanity (warn-only)
    if (!(E < N && N < W && W < S && S < E_next)) {
        dbg?.warn?.('horizon.anchors.nonMonotonic', {
            E: fmt(E),
            N: fmt(N),
            W: fmt(W),
            S: fmt(S),
            E_next: fmt(E_next),
        });
    }

    // segment indices:
    // 0..4   : E -> N
    // 4..8   : N -> W
    // 8..12  : W -> S
    // 12..16 : S -> E_next
    const spokes: CycleSpoke<HorizonMeta>[] = [];

    // We need altAt for height-driven spokes (cached, budgeted).
    const { altAt } = makeAltProvider(obs, target, dbg);

    const altN = altAt(N);
    const altS = altAt(S);

    if (!Number.isFinite(altN) || !Number.isFinite(altS)) {
        return fail(`Horizon: failed to sample anchor altitudes (target=${String(target)}).`);
    }

    // Fallback: old time-linear interpolation (per segment)
    const fallbackTimeLinear = (i: number) => {
        let t: number;
        if (i <= 4) {
            const u = i / 4;
            t = lerp(E, N, u);
        } else if (i <= 8) {
            const u = (i - 4) / 4;
            t = lerp(N, W, u);
        } else if (i <= 12) {
            const u = (i - 8) / 4;
            t = lerp(W, S, u);
        } else {
            const u = (i - 12) / 4;
            t = lerp(S, E_next, u);
        }
        if (i === 0) t = E;
        if (i === 4) t = N;
        if (i === 8) t = W;
        if (i === 12) t = S;
        if (i === 16) t = E_next;
        return t;
    };

    // Height-driven spoke time solver per quarter.
    // Each quarter: pick target altitude h by linear interpolation between endpoint altitudes,
    // then invert altitude(t)=h on that quarter's time interval using bisection (minute precision).
    const solveQuarter = (t0: number, t1: number, h0: number, h1: number, u01: number) => {
        const h = lerp(h0, h1, u01);

        // Bracketing check: ensure h lies between endpoint altitudes (inclusive).
        const a0 = altAt(t0);
        const a1 = altAt(t1);
        if (!Number.isFinite(a0) || !Number.isFinite(a1)) return null;

        const loH = Math.min(a0, a1);
        const hiH = Math.max(a0, a1);

        // allow tiny numerical slack near endpoints
        const EPS = 1e-6;
        if (h < loH - EPS || h > hiH + EPS) return null;

        return findTimeAtAltitudeMs({
            t0,
            t1,
            altAt,
            targetAltDeg: h,
            refineEpsMs: 60_000, // minute precision
        });
    };

    for (let i = 0; i <= 16; i++) {
        let t: number | null = null;

        // hard anchors (exact)
        if (i === 0) t = E;
        else if (i === 4) t = N;
        else if (i === 8) t = W;
        else if (i === 12) t = S;
        else if (i === 16) t = E_next;
        else {
            if (i < 4) {
                // E -> N : 0 .. altN
                const u = i / 4;
                t = solveQuarter(E, N, 0, altN, u);
            } else if (i < 8) {
                // N -> W : altN .. 0
                const u = (i - 4) / 4;
                t = solveQuarter(N, W, altN, 0, u);
            } else if (i < 12) {
                // W -> S : 0 .. altS (altS is negative)
                const u = (i - 8) / 4;
                t = solveQuarter(W, S, 0, altS, u);
            } else {
                // S -> E_next : altS .. 0
                const u = (i - 12) / 4;
                t = solveQuarter(S, E_next, altS, 0, u);
            }
        }

        // Fallback if numerical bracketing fails (rare but possible in weird regimes).
        if (!isFiniteTs(t)) {
            const tfb = fallbackTimeLinear(i);
            dbg?.warn?.('horizon.spoke.heightSolveFailed.fallbackTimeLinear', {
                i,
                target,
                fallbackTs: fmt(tfb),
            });
            t = tfb;
        }

        const spoke = mkSpoke(i, t, obs, target);
        spoke.tags = cycleSpokeTags('horizon', spoke.code);
        spokes.push(spoke);
    }

    // monotonic check (warn-only)
    for (let i = 1; i < spokes.length; i++) {
        if (!(spokes[i].ts >= spokes[i - 1].ts)) {
            dbg?.warn?.('horizon.spokes.nonMonotonic', {
                i,
                prev: { i: i - 1, ts: fmt(spokes[i - 1].ts), code: spokes[i - 1].code },
                cur: { i, ts: fmt(spokes[i].ts), code: spokes[i].code },
            });
            break;
        }
    }

    dbg?.log?.('horizon.done', { ts: fmt(ts), target, spokesCount: spokes.length });

    return { ok: true, kind: 'cycle', ts, spokes };
}
