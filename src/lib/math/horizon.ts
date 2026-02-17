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

import type { BodyId } from '../catalog';
import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import { SPOKES_ORDER } from '../wheel/types';
import { AU_KM, clamp, norm360 } from './helpers';

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

function toEngineBody(id: BodyId): EngineBody {
    return EngineBody[id as keyof typeof EngineBody];
}

function makeObserver(lat: number, lon: number, heightMeters = 0) {
    return new Observer(lat, lon, heightMeters);
}

/**
 * Compute (alt, az, eq) for target at time ts for a topocentric observer.
 * Refraction is DISABLED (geometric horizon).
 */
function targetState(ts: number, obs: Observer, target: BodyId): {
    altDeg: number;
    azDeg: number;
    raHours: number;
    decDeg: number;
    distAu: number;
} | null {
    try {
        const time = new AstroTime(new Date(ts));
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

function targetAltitudeDeg(ts: number, obs: Observer, target: BodyId): number {
    const s = targetState(ts, obs, target);
    return s ? s.altDeg : NaN;
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
function makeAltProvider(obs: Observer, target: BodyId, dbg?: WheelInput['dbg']): AltProvider {
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

function computeCycleAroundTs(ts: number, obs: Observer, target: BodyId, dbg?: WheelInput['dbg']): RiseSetCycle | null {
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

function lerp(a: number, b: number, u01: number) {
    return a + (b - a) * u01;
}

function mkSpoke(index: number, ts: number, obs: Observer, target: BodyId): CycleSpoke<HorizonMeta> {
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
        meta: {
            altitudeDeg: isFiniteNumber(alt) ? alt : NaN,
            azimuthDeg: isFiniteNumber(az) ? az : NaN,
            raHours: st?.raHours,
            decDeg: st?.decDeg,
            distanceAu: distAu,
            distanceKm: distKm,
        },
    };
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

    const looker = (input.looker ?? 'Earth') as BodyId;
    if (looker !== 'Earth') {
        return fail(`Horizon: topocentric horizon supported only for looker=Earth (got ${String(looker)}).`);
    }

    const rawTarget = input.target;
    const target: BodyId | null = Array.isArray(rawTarget) ? (rawTarget[0] ?? null) : (rawTarget ?? null);
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

    const spokes: CycleSpoke<HorizonMeta>[] = [];

    // segment indices:
    // 0..4   : E -> N
    // 4..8   : N -> W
    // 8..12  : W -> S
    // 12..16 : S -> E_next
    for (let i = 0; i <= 16; i++) {
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

        // hard-anchor exact keypoints (avoid float drift)
        if (i === 0) t = E;
        if (i === 4) t = N;
        if (i === 8) t = W;
        if (i === 12) t = S;
        if (i === 16) t = E_next;

        spokes.push(mkSpoke(i, t, obs, target));
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
