// src/lib/cycles/lunarDraconic.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from '../wheel/spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { utcYearFromTs } from '../wheel/wheel';
import { isFiniteNumber } from '../math/helpers';
import { debug } from '../debug';

const dbg = debug('lunarDraconic', '☀🐲');
const { group, log, warn } = dbg;

const DAY_MS = 86400_000;

// Draconic month ≈ 27.212220817 days (node -> same node)
const DRACONIC_MONTH_DAYS = 27.212220817;
const DRACONIC_MONTH_MS = DRACONIC_MONTH_DAYS * DAY_MS;

const EXACT_MIN_YEAR = 1600;
const EXACT_MAX_YEAR = 2400;

// scanning/search params
const SCAN_STEP_MS = 6 * 60 * 60_000;      // 6 hours
const BRACKET_DAYS = 20;                   // search window for finding a sign change
const BISECT_ITERS = 60;
const EPS_LAT = 1e-10;

// maxima/minima search
const EXT_SAMPLE_STEP_MS = 2 * 60 * 60_000; // 2 hours
const HILL_STEP_START_MS = 6 * 60 * 60_000; // 6 hours
const HILL_STEP_MIN_MS = 30_000;            // 30 sec

// Safety guard for strict comparisons (ms jitter between calls)
const STRICT_GUARD_MS = 1500;

function fmt(ts: number) {
    if (!Number.isFinite(ts)) return String(ts);
    return new Date(ts).toISOString();
}

type NodeKind = 'Ascending' | 'Descending';

type NodeEvent = {
    kind: NodeKind;
    time: { date: Date };
};

// ---------- Exact range ----------
function inExactRange(ts: number) {
    const y = utcYearFromTs(ts);
    if (y === null) return false;
    return y >= EXACT_MIN_YEAR && y <= EXACT_MAX_YEAR;
}

// ---------- Core astronomy: Moon ecliptic latitude ----------
function moonEclipticLatDeg(ts: number): number {
    // In astronomy-engine JS, EclipticGeoMoon(dateOrTime) returns an object that contains `lat` in degrees.
    const d = new Date(ts);
    const sph = (Astronomy as any).EclipticGeoMoon(d);

    const lat = sph?.lat;
    if (!(typeof lat === 'number' && Number.isFinite(lat))) {
        throw new Error(`EclipticGeoMoon returned bad lat: ${JSON.stringify(sph)}`);
    }
    return lat;
}

// Helper: sign with small epsilon
type Sign = -1 | 0 | 1;
function sgn(x: number): Sign {
    if (x > EPS_LAT) return 1;
    if (x < -EPS_LAT) return -1;
    return 0;
}

// Bisection to solve lat(t)=0 inside [t1, t2] where lat has opposite signs.
function solveLatZero(t1: number, t2: number): number {
    let a = t1, b = t2;
    let fa = moonEclipticLatDeg(a);
    let fb = moonEclipticLatDeg(b);

    if (sgn(fa) === 0) return a;
    if (sgn(fb) === 0) return b;

    if (sgn(fa) === sgn(fb)) {
        throw new Error(`solveLatZero called without bracketing: fa=${fa}, fb=${fb}`);
    }

    for (let i = 0; i < BISECT_ITERS; i++) {
        const m = ms((a + b) / 2);
        const fm = moonEclipticLatDeg(m);
        const sm = sgn(fm);

        if (sm === 0) return m;

        if (sgn(fa) === sm) {
            a = m;
            fa = fm;
        } else {
            b = m;
            fb = fm;
        }
    }
    return ms((a + b) / 2);
}

// Determine node kind by checking the sign change direction around the root.
function classifyNode(rootTs: number): NodeKind {
    const dt = 60 * 60_000; // 1 hour
    const before = moonEclipticLatDeg(rootTs - dt);
    const after = moonEclipticLatDeg(rootTs + dt);

    // Ascending node: lat goes from negative to positive.
    if (before < 0 && after > 0) return 'Ascending';
    if (before > 0 && after < 0) return 'Descending';

    // Fallback: use slope sign
    return (after - before) >= 0 ? 'Ascending' : 'Descending';
}

// Scan forward (or backward) from a starting time to find the nearest bracket of lat sign change.
function findBracket(ts0: number, dir: -1 | 1): [number, number] | null {
    const limit = ts0 + dir * BRACKET_DAYS * DAY_MS;
    let tPrev = ts0;
    let fPrev = moonEclipticLatDeg(tPrev);
    let sPrev = sgn(fPrev);

    // If we start exactly at 0, nudge.
    if (sPrev === 0) {
        tPrev = ts0 + dir * (SCAN_STEP_MS / 4);
        fPrev = moonEclipticLatDeg(tPrev);
        sPrev = sgn(fPrev);
    }

    for (let t = ts0 + dir * SCAN_STEP_MS; dir > 0 ? t <= limit : t >= limit; t += dir * SCAN_STEP_MS) {
        const f = moonEclipticLatDeg(t);
        const s: Sign = sgn(f);

        if (s === 0) {
            // Rare, but if exact, make a tiny bracket around it.
            return [t - dir * SCAN_STEP_MS, t];
        }

        // @ts-ignore
        if (sPrev !== 0 && s !== 0 && sPrev !== s) {
            // bracket found
            return dir > 0 ? [tPrev, t] : [t, tPrev];
        }

        tPrev = t;
        fPrev = f;
        sPrev = s;
    }

    return null;
}

// Find next node after (or equal) ts.
function findNextNode(ts: number): NodeEvent | null {
    const br = findBracket(ts, +1);
    if (!br) return null;
    const root = solveLatZero(br[0], br[1]);
    const kind = classifyNode(root);
    return { kind, time: { date: new Date(root) } };
}

// Find previous node before (or equal) ts.
function findPrevNode(ts: number): NodeEvent | null {
    const br = findBracket(ts, -1);
    if (!br) return null;
    const root = solveLatZero(br[0], br[1]);
    const kind = classifyNode(root);
    return { kind, time: { date: new Date(root) } };
}

function tsOf(e: NodeEvent) {
    return ms(e.time.date.getTime());
}

// Walk backwards until we hit previous node of given kind.
function searchPrevNodeOfKind(ts: number, kind: NodeKind, maxSteps = 12): NodeEvent | null {
    let curTs = ts;
    for (let i = 0; i < maxSteps; i++) {
        const ev = findPrevNode(curTs);
        if (!ev) return null;

        const t = tsOf(ev);
        log('searchPrevNodeOfKind step', i, 'want=', kind, 'got=', ev.kind, 't=', fmt(t), 'from=', fmt(curTs));

        if (ev.kind === kind && t <= ts) return ev;

        // step further back a bit beyond this node
        curTs = t - STRICT_GUARD_MS;
    }
    return null;
}

// Walk forward until we hit next node of given kind.
function searchNextNodeOfKind(ts: number, kind: NodeKind, maxSteps = 12): NodeEvent | null {
    let curTs = ts;
    for (let i = 0; i < maxSteps; i++) {
        const ev = findNextNode(curTs);
        if (!ev) return null;

        const t = tsOf(ev);
        log('searchNextNodeOfKind step', i, 'want=', kind, 'got=', ev.kind, 't=', fmt(t), 'from=', fmt(curTs));

        if (ev.kind === kind && t >= ts) return ev;

        // step forward a bit beyond this node
        curTs = t + STRICT_GUARD_MS;
    }
    return null;
}

// Find extremum of moon latitude on [t0, t1] (max or min).
function findLatExtremum(ts0: number, ts1: number, mode: 'max' | 'min'): number {
    const lo = Math.min(ts0, ts1);
    const hi = Math.max(ts0, ts1);

    // coarse sampling
    let bestT = lo;
    let bestV = moonEclipticLatDeg(bestT);

    for (let t = lo; t <= hi; t += EXT_SAMPLE_STEP_MS) {
        const v = moonEclipticLatDeg(t);
        if (mode === 'max') {
            if (v > bestV) { bestV = v; bestT = t; }
        } else {
            if (v < bestV) { bestV = v; bestT = t; }
        }
    }

    // hill-climb refine
    let step = HILL_STEP_START_MS;
    let curT = bestT;
    let curV = bestV;

    while (step >= HILL_STEP_MIN_MS) {
        const tL = Math.max(lo, curT - step);
        const tR = Math.min(hi, curT + step);

        const vL = moonEclipticLatDeg(tL);
        const vR = moonEclipticLatDeg(tR);

        if (mode === 'max') {
            if (vL > curV) { curT = tL; curV = vL; continue; }
            if (vR > curV) { curT = tR; curV = vR; continue; }
        } else {
            if (vL < curV) { curT = tL; curV = vL; continue; }
            if (vR < curV) { curT = tR; curV = vR; continue; }
        }

        step = Math.floor(step / 2);
    }

    return ms(curT);
}

function midpoint(a: number, b: number) {
    return ms((a + b) / 2);
}

function insideCycle(M: number, a: Anchors) {
    // half-open interval prevents boundary glitches when M == end
    return M >= a.start && M < a.end;
}

// ---------- Approx fallback (very rough) ----------
const APPROX_EPOCH_ASC_NODE_MS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);

function approxAnchors(ts: number): Anchors {
    const period = DRACONIC_MONTH_MS;
    const half = period / 2;
    const quarter = period / 4;

    const k = Math.floor((ts - APPROX_EPOCH_ASC_NODE_MS) / period);
    let E = APPROX_EPOCH_ASC_NODE_MS + k * period;
    while (E > ts) E -= period;
    while (E + period <= ts) E += period;
    E = ms(E);

    const W = ms(E + half);
    const N = ms(E + quarter);
    const S = ms(E + 3 * quarter);
    const E_next = ms(E + period);

    return { start: E, end: E_next, E, N, W, S, E_next };
}

// ---------- Build draconic cycle ----------
//
// Mapping you wanted:
//   E = Ascending node (Moon crosses ecliptic south->north)
//   W = Descending node (north->south)
//   N = maximum north ecliptic latitude between E and W
//   S = maximum south ecliptic latitude between W and E_next
//
function buildCycleFromAscending(E0: NodeEvent): Anchors | null {
    const tE0 = tsOf(E0);
    if (E0.kind !== 'Ascending') {
        warn('buildCycleFromAscending: expected Ascending, got', E0.kind, fmt(tE0));
        return null;
    }

    const W0 = searchNextNodeOfKind(tE0 + STRICT_GUARD_MS, 'Descending');
    if (!W0) return null;

    const E1 = searchNextNodeOfKind(tsOf(W0) + STRICT_GUARD_MS, 'Ascending');
    if (!E1) return null;

    const tW0 = tsOf(W0);
    const tE1 = tsOf(E1);

    // Find max/min latitude times in each half-interval.
    const N = findLatExtremum(tE0, tW0, 'max');
    const S = findLatExtremum(tW0, tE1, 'min');

    const E = tE0;
    const W = tW0;
    const E_next = tE1;

    log('cycle points', {
        E: fmt(E),
        N: fmt(N),
        W: fmt(W),
        S: fmt(S),
        E_next: fmt(E_next),
        // quick sanity lat values:
        latN: moonEclipticLatDeg(N).toFixed(4),
        latS: moonEclipticLatDeg(S).toFixed(4),
    });

    // sanity monotonic in time
    if (!(E < N && N < W && W < S && S < E_next)) {
        // If extrema searches slightly misbehaved, fall back to midpoints (still valid ordering).
        const N2 = midpoint(E, W);
        const S2 = midpoint(W, E_next);

        warn('non-monotonic extrema, fallback to midpoints', {
            E: fmt(E),
            N: fmt(N),
            N2: fmt(N2),
            W: fmt(W),
            S: fmt(S),
            S2: fmt(S2),
            E_next: fmt(E_next),
        });

        return { start: E, end: E_next, E, N: N2, W, S: S2, E_next };
    }

    const spanDays = (E_next - E) / DAY_MS;
    if (!(spanDays > 10 && spanDays < 60)) {
        warn('suspicious span', spanDays.toFixed(3), 'days');
        return null;
    }

    return { start: E, end: E_next, E, N, W, S, E_next };
}

export function getDraconicAnchors(ts: number): Anchors {
    if (!isFiniteNumber(ts)) return approxAnchors(Date.now());
    const M = ms(ts);

    return group(`M=${fmt(M)}`, () => {
        log('inExactRange =', inExactRange(M));

        if (!inExactRange(M)) {
            log('→ approx (out of range)');
            return approxAnchors(M);
        }

        // Previous Ascending node <= M
        let E0 = searchPrevNodeOfKind(M + STRICT_GUARD_MS, 'Ascending');
        if (!E0) {
            warn('prev Asc not found → approx');
            return approxAnchors(M);
        }

        // Make sure the cycle we build contains M; adjust if needed.
        for (let hop = 0; hop < 10; hop++) {
            const c = buildCycleFromAscending(E0);
            if (!c) {
                warn('cycle build failed → approx');
                return approxAnchors(M);
            }

            const inside = insideCycle(M, c);
            log(`hop=${hop}`, { inside, start: fmt(c.start), end: fmt(c.end), E: fmt(c.E), W: fmt(c.W), M: fmt(M) });

            if (inside) return c;

            if (M < c.start) {
                // step to previous Asc
                const prev = searchPrevNodeOfKind(tsOf(E0) - STRICT_GUARD_MS, 'Ascending');
                if (!prev) return approxAnchors(M);
                E0 = prev;
                continue;
            }

            // M >= end -> step to next Asc
            const next = searchNextNodeOfKind(tsOf(E0) + STRICT_GUARD_MS, 'Ascending');
            if (!next) return approxAnchors(M);
            E0 = next;
        }

        warn('MAX hops reached → approx');
        return approxAnchors(M);
    }) as Anchors;
}

export const angleFromDraconicAnchors = angleFromAnchors;
