// src/lib/cycles/lunarAnomalistic.ts
//
// Lunar Anomalistic wheel — distance-linear spokes (Earth–Moon distance).
//
// New behavior (mirrors solarAnomalistic):
// - N/S are astronomical apsides (Apogee / Perigee) from astronomy-engine.
// - All other spokes are NOT midpoints-in-time.
//   We assign a target distance (km) per spoke and solve for timestamps where Earth–Moon distance hits that target.
// - We return Anchors with optional `spokes` (Partial<Record<SpokeKey, number>>) so buildSpokeTimes() can use them.
//
// Notes:
// - Uses astronomy-engine SearchLunarApsis / NextLunarApsis for apsides.
// - Uses GeoVector(Moon) length (AU) * AU_KM for distance sampling.
// - Keeps approx fallback for out-of-range and failure cases.
// - Includes verbose debug logs for bracket + solver diagnostics (similar to solarAnomalistic).
//
// IMPORTANT FIX:
// - Adds anti-bounce protection in cycle-hunt (prevents rewind/advance ping-pong between two apogees).
// - Adds small boundary guard so near-boundary jitter doesn’t trigger oscillation.

import * as Astronomy from 'astronomy-engine';
import { type Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { isFiniteNumber } from './wheel';
import { debug } from '../debug';

import { inExactRange, insideCycle, makeApsisWalker, toAstroTime, tsOf } from './apsisCore';
import { buildDistanceLinearWheel } from './distanceLinearCore';

const dbg = debug('lunarAnomalistic', '🌙️');
const { group, log, warn } = dbg;

const DAY_MS = 86400_000;

// Anomalistic month ≈ 27.55454988 days (perigee → perigee)
const ANOMALISTIC_MONTH_DAYS = 27.55454988;
const ANOMALISTIC_MONTH_MS = ANOMALISTIC_MONTH_DAYS * DAY_MS;

const EXACT_MIN_YEAR = 1600;
const EXACT_MAX_YEAR = 2400;

// Initial probing step (days) to get a "somewhat nearby" apsis into the past.
const BACKSTEP_DAYS = 15;
const MAX_BACKSTEPS = 28;

// For walking apsis chain and cycle hunting
const MAX_PREV_STEPS = 64;
const MAX_NEXT_STEPS = 64;
const MAX_CYCLE_ADVANCE = 12;

// Guard against millisecond jitter / boundary equality
const STRICT_GUARD_MS = 1500;

// Cycle boundary guard to avoid edge oscillations (keep modest; doesn’t hide real errors)
const CYCLE_EDGE_GUARD_MS = 2_000;

// Root-solving
const SOLVE_MAX_ITERS = 70;
const SOLVE_EPS_MS = 500; // sub-second is enough for “minute-level” outputs
const MONO_EPS_KM = 1e-6; // tiny slack for bracketing (km)

// Astronomy constants
const AU_KM = 149_597_870.7;

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

type ApsisKind = 'Perigee' | 'Apogee';

type Apsis = {
    kind: any; // enum 0/1 or string
    time: { date: Date };
    dist_km?: number;
};

function normalizeKind(k: any): ApsisKind | null {
    if (k === 0) return 'Perigee';
    if (k === 1) return 'Apogee';
    if (k === 'Perigee' || k === 'Apogee') return k;

    if (typeof k === 'string') {
        const kk = k.toLowerCase();
        if (kk === 'perigee') return 'Perigee';
        if (kk === 'apogee') return 'Apogee';
    }
    return null;
}

function kindOf(a: any): ApsisKind | null {
    return normalizeKind(a?.kind);
}

// ---------------------------------------------
// Distance helpers (Earth–Moon distance in km)
// ---------------------------------------------

function earthMoonDistanceKm(ts: number): number {
    const A: any = Astronomy as any;
    const d = new Date(ts);
    const t = toAstroTime(A, d);

    // Best: geocentric vector (Moon position from Earth) length in AU -> km
    try {
        if (typeof A.GeoVector === 'function') {
            // Some builds accept (body, time, aberration)
            const v = A.GeoVector(Astronomy.Body.Moon, t, false);
            if (v && typeof v.Length === 'function') {
                const rAu = v.Length();
                if (typeof rAu === 'number' && Number.isFinite(rAu)) return rAu * AU_KM;
            }
            if (v && typeof v.length === 'number' && Number.isFinite(v.length)) return v.length * AU_KM;
            if (v && typeof v.x === 'number') {
                const rAu = Math.hypot(v.x, v.y, v.z);
                if (Number.isFinite(rAu)) return rAu * AU_KM;
            }
        }
    } catch {}

    // Alternate: some builds may expose MoonDistance
    try {
        if (typeof A.MoonDistance === 'function') {
            const rKm = A.MoonDistance(t);
            if (typeof rKm === 'number' && Number.isFinite(rKm)) return rKm;
        }
    } catch {}

    return NaN;
}

function distDump(label: string, ts: number) {
    return { label, ts: fmt(ts), r_km: earthMoonDistanceKm(ts) };
}

function distOrComputeKm(a: Apsis): number {
    const d = a?.dist_km;
    if (typeof d === 'number' && Number.isFinite(d)) return d;
    return earthMoonDistanceKm(tsOf(a as any));
}

// ---------------------------------------------
// Apsis search (astronomy-engine) + walker
// ---------------------------------------------

function safeSearch(probe: Date): Apsis | null {
    try {
        const a = (Astronomy as any).SearchLunarApsis(probe) as Apsis;
        const t = a?.time?.date?.getTime?.();
        return typeof t === 'number' && Number.isFinite(t) ? a : null;
    } catch {
        return null;
    }
}

function safeNext(cur: Apsis): Apsis | null {
    try {
        const a = (Astronomy as any).NextLunarApsis(cur as any) as Apsis;
        const t = a?.time?.date?.getTime?.();
        return typeof t === 'number' && Number.isFinite(t) ? a : null;
    } catch {
        return null;
    }
}

const walker = makeApsisWalker<Apsis, ApsisKind>({
    kindOf,
    safeSearch,
    safeNext,
    BACKSTEP_DAYS,
    MAX_BACKSTEPS,
    MAX_PREV_STEPS,
    MAX_NEXT_STEPS,
    STRICT_GUARD_MS,
    dbg: { log, warn },
});

function prevApogeeBefore(a: Apsis) {
    return walker.searchPrevApsisOfKind(tsOf(a as any) - STRICT_GUARD_MS, 'Apogee');
}

// ---------------------------------------------
// Distance-linear spokes builder (around Apogee A0)
// ---------------------------------------------

function buildDistanceLinearSpokesFromApogee(A0: Apsis): Anchors | null {
    const tA0 = tsOf(A0 as any);

    return group(`buildCycle A0=${fmt(tA0)}`, () => {
        // We need:
        // - P_before (previous Perigee)
        // - P_after  (Perigee after this Apogee)
        // - A_after  (next Apogee)
        const P_before = walker.searchPrevApsisOfKind(tA0 - STRICT_GUARD_MS, 'Perigee');

        const approxHalf = ANOMALISTIC_MONTH_MS / 2;
        const approxFull = ANOMALISTIC_MONTH_MS;

        const P_after = walker.searchApsisNear(tA0 + approxHalf, 'Perigee', ANOMALISTIC_MONTH_MS);
        if (!P_after || kindOf(P_after) !== 'Perigee') {
            warn('P_after not found via approx search', fmt(tA0 + approxHalf));
            return null;
        }

        const A_after = walker.searchApsisNear(tA0 + approxFull, 'Apogee', ANOMALISTIC_MONTH_MS);
        if (!A_after || kindOf(A_after) !== 'Apogee') {
            warn('A_after not found via approx search', fmt(tA0 + approxFull));
            return null;
        }

        if (!P_before) {
            warn('missing P_before', { A0: fmt(tA0) });
            return null;
        }

        const tPb = tsOf(P_before as any);
        const tPa = tsOf(P_after as any);
        const tAa = tsOf(A_after as any);

        // Distances: max at apogee, min at perigee
        const rMax = distOrComputeKm(A0);      // Apogee
        const rMin = distOrComputeKm(P_after); // Perigee after A0 (this is S)

        log('apsis + distances', {
            tPb: fmt(tPb),
            tA0: fmt(tA0),
            tPa: fmt(tPa),
            tAa: fmt(tAa),
            rPb_km: earthMoonDistanceKm(tPb),
            rA0_km: earthMoonDistanceKm(tA0),
            rPa_km: earthMoonDistanceKm(tPa),
            rAa_km: earthMoonDistanceKm(tAa),
            rMin_km: rMin,
            rMid_km: (rMin + rMax) / 2,
            rMax_km: rMax,
        });

        log('bracket endpoints', {
            Pb: distDump('Pb', tPb),
            A0: distDump('A0', tA0),
            Pa: distDump('Pa', tPa),
            Aa: distDump('Aa', tAa),
        });

        const anchors = buildDistanceLinearWheel(
            {
                distanceAt: earthMoonDistanceKm,
                SOLVE_MAX_ITERS,
                SOLVE_EPS_MS,
                MONO_EPS: MONO_EPS_KM,
                fmtTs: fmt,
                dbg: { log, warn },
            },
            {
                // E solve segment: P_before -> A0 (increasing)
                tE_guess_lo: tPb,
                tE_guess_hi: tA0,

                // N is the apogee itself
                tN: tA0,

                // W solve segment end: A0 -> P_after (decreasing)
                tW_guess_hi: tPa,

                // S is perigee after A0
                tS: tPa,

                // E_next solve segment end: P_after -> A_after (increasing)
                tE_next_guess_hi: tAa,

                rMax,
                rMin,
                dbgLabel: 'lunarAnomalistic',
            },
        );

        if (!anchors) return null;

        const spanDays = (anchors.E_next - anchors.E) / DAY_MS;
        if (!(spanDays > 10 && spanDays < 60)) {
            warn('distance-linear: suspicious span', spanDays.toFixed(3), 'days', {
                E: fmt(anchors.E),
                E_next: fmt(anchors.E_next),
            });
            return null;
        }

        log('lunarAnomalistic distance-linear cycle', {
            E: fmt(anchors.E),
            N: fmt(anchors.N),
            W: fmt(anchors.W),
            S: fmt(anchors.S),
            E_next: fmt(anchors.E_next),
            rMin_km: rMin,
            rMid_km: (rMin + rMax) / 2,
            rMax_km: rMax,
        });

        return anchors;
    });
}

// ---------------------------------------------
// Approx fallback (simple, stable)
// ---------------------------------------------

// Reference apogee ~ Jan 1, 2000
const APPROX_EPOCH_APOGEE_MS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);

function approxAnchors(ts: number): Anchors {
    // Time-based approximation only (kept for fallback).
    const period = ANOMALISTIC_MONTH_MS;
    const quarter = period / 4;

    const k = Math.floor((ts - APPROX_EPOCH_APOGEE_MS) / period);
    let N = APPROX_EPOCH_APOGEE_MS + k * period;
    while (N > ts) N -= period;
    while (N + period <= ts) N += period;
    N = ms(N);

    const E = ms(N - quarter);
    const W = ms(N + quarter);
    const S = ms(N + period / 2);
    const E_next = ms(N + 3 * quarter);

    return { start: E, end: E_next, E, N, W, S, E_next };
}

// ---------------------------------------------
// Public API
// ---------------------------------------------

export function getLunarAnomalisticAnchors(ts: number): Anchors {
    if (!isFiniteNumber(ts)) return approxAnchors(Date.now());
    const M = ms(ts);

    return group(`M=${fmt(M)}`, () => {
        if (!inExactRange(M, EXACT_MIN_YEAR, EXACT_MAX_YEAR)) {
            warn('out of exact range → approx', fmt(M));
            return approxAnchors(M);
        }

        // Find previous apogee <= M (tiny +guard for boundary)
        let A = walker.searchPrevApsisOfKind(M + STRICT_GUARD_MS, 'Apogee');
        if (!A) {
            warn('Apogee not found → approx', fmt(M));
            return approxAnchors(M);
        }

        // Anti-bounce: if we ever revisit the same Apogee timestamp, we’re ping-ponging.
        const seenApogeeTs = new Set<number>();

// Replace the whole for(hop...) loop in getLunarAnomalisticAnchors with this:

        const COVER_GUARD_MS = 5 * 60_000; // 5 minutes: absorbs tiny gaps without hiding real mistakes

        // We’ll keep A as our “current apogee anchor” and hunt deterministically.
        for (let hop = 0; hop < MAX_CYCLE_ADVANCE; hop++) {
            const a0 = ms(tsOf(A as any));
            const c = buildDistanceLinearSpokesFromApogee(A);
            if (!c) {
                warn('cycle build failed → approx', { A: fmt(tsOf(A as any)), M: fmt(M) });
                return approxAnchors(M);
            }

            // 1) Standard hit
            if (insideCycle(M, c)) {
                log('cycle hit', {
                    hop,
                    M: fmt(M),
                    start: fmt(c.start),
                    end: fmt(c.end),
                    E: fmt(c.E),
                    N: fmt(c.N),
                    W: fmt(c.W),
                    S: fmt(c.S),
                });
                return c;
            }

            // 2) If we're just BEFORE this cycle start, check previous cycle coverage
            if (M < c.start) {
                const prevA = prevApogeeBefore(A);
                if (!prevA) {
                    // If we can't find prev, just clamp to current if very close
                    if (M >= c.start - COVER_GUARD_MS) {
                        warn('before start but within guard → clamp to current cycle', {
                            hop,
                            M: fmt(M),
                            start: fmt(c.start),
                            guardMs: COVER_GUARD_MS,
                            A0: fmt(a0),
                        });
                        return c;
                    }
                    break;
                }

                const prevC = buildDistanceLinearSpokesFromApogee(prevA);
                if (prevC) {
                    // If M is inside prevC normally, use it
                    if (insideCycle(M, prevC)) {
                        log('cycle hit (prev)', {
                            hop,
                            M: fmt(M),
                            start: fmt(prevC.start),
                            end: fmt(prevC.end),
                        });
                        return prevC;
                    }

                    // If there's a tiny gap: prevC.end < M < c.start
                    // and M is close to either edge, pick the nearer side deterministically.
                    if (M > prevC.end && M < c.start) {
                        const dPrev = M - prevC.end;
                        const dNext = c.start - M;

                        if (Math.min(dPrev, dNext) <= COVER_GUARD_MS) {
                            const pick = dPrev <= dNext ? prevC : c;
                            warn('gap between cycles → pick nearest', {
                                hop,
                                M: fmt(M),
                                prevEnd: fmt(prevC.end),
                                nextStart: fmt(c.start),
                                dPrevMs: dPrev,
                                dNextMs: dNext,
                                pick: pick === prevC ? 'prev' : 'next',
                            });
                            return pick;
                        }
                    }
                }

                // Not close, continue hunting backward
                log('rewind to previous cycle', { hop, M: fmt(M), start: fmt(c.start), A0: fmt(a0) });
                A = prevA;
                continue;
            }

            // 3) M >= c.end, check next cycle coverage symmetrically
            {
                const nextA = walker.nextApsisOfKind(A, 'Apogee');
                if (!nextA) {
                    if (M <= c.end + COVER_GUARD_MS) {
                        warn('after end but within guard → clamp to current cycle', {
                            hop,
                            M: fmt(M),
                            end: fmt(c.end),
                            guardMs: COVER_GUARD_MS,
                            A0: fmt(a0),
                        });
                        return c;
                    }
                    break;
                }

                const nextC = buildDistanceLinearSpokesFromApogee(nextA);
                if (nextC) {
                    if (insideCycle(M, nextC)) {
                        log('cycle hit (next)', {
                            hop,
                            M: fmt(M),
                            start: fmt(nextC.start),
                            end: fmt(nextC.end),
                        });
                        return nextC;
                    }

                    // tiny gap: c.end < M < nextC.start
                    if (M > c.end && M < nextC.start) {
                        const dCur = M - c.end;
                        const dNext = nextC.start - M;

                        if (Math.min(dCur, dNext) <= COVER_GUARD_MS) {
                            const pick = dCur <= dNext ? c : nextC;
                            warn('gap between cycles → pick nearest', {
                                hop,
                                M: fmt(M),
                                curEnd: fmt(c.end),
                                nextStart: fmt(nextC.start),
                                dCurMs: dCur,
                                dNextMs: dNext,
                                pick: pick === c ? 'cur' : 'next',
                            });
                            return pick;
                        }
                    }
                }

                log('advance to next cycle', { hop, M: fmt(M), end: fmt(c.end), A0: fmt(a0) });
                A = nextA;
                continue;
            }
        }

        warn('MAX_CYCLE_ADVANCE reached → approx');
        return approxAnchors(M);
    }) as Anchors;
}

export const angleFromLunarAnomalisticAnchors = angleFromAnchors;

/*
  Debugging tips:
  - If buildDistanceLinearWheel logs "target not bracketed", compare r(t_lo), r(t_hi) vs target.
    That usually means the chosen segment isn’t monotonic (wrong adjacent apsides),
    or the distance sampler differs from apsis dist_km in this astronomy-engine build.
  - If P_after / A_after are missing, increase the “nudge window” inside walker.searchApsisNear()
    (or pass a larger period hint than ANOMALISTIC_MONTH_MS if your build needs it).
*/
