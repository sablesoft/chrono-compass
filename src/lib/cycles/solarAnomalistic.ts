// src/lib/cycles/solarAnomalistic.ts
//
// Solar Anomalistic wheel — distance-linear spokes.
//
// New behavior:
// - N/S are astronomical apsides (Aphelion / Perihelion) from astronomy-engine.
// - All other spokes are NOT midpoints-in-time.
//   We assign a target distance (AU) per spoke and solve for timestamps where Earth–Sun distance hits that target.
// - We return Anchors with optional `spokes` (Partial<Record<SpokeKey, number>>) so buildSpokeTimes() can use them.
//
// Uses shared cores:
// - apsisCore: time helpers + apsis walker utilities
// - distanceLinearCore: generic distance-linear wheel builder (E/W/E_next + 16 spokes)

import * as Astronomy from 'astronomy-engine';
import { type Anchors } from '../wheel/spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { isFiniteNumber } from '../math/helpers';
import { debug } from '../debug';

import { inExactRange, insideCycle, makeApsisWalker, toAstroTime, tsOf } from './coreApsis';
import { buildDistanceLinearWheel } from './coreDistanceLinear';

const dbg = debug('solarAnomalistic', '☀️');
const { group, log, warn } = dbg;

const DAY_MS = 86400_000;

// Anomalistic year ≈ 365.259636 days (perihelion → perihelion)
const ANOMALISTIC_YEAR_DAYS = 365.259636;
const ANOMALISTIC_YEAR_MS = ANOMALISTIC_YEAR_DAYS * DAY_MS;

const EXACT_MIN_YEAR = 1600;
const EXACT_MAX_YEAR = 2400;

// year scale probing
const BACKSTEP_DAYS = 60;
const MAX_BACKSTEPS = 24;
const MAX_PREV_STEPS = 32;
const MAX_NEXT_STEPS = 32;
const MAX_CYCLE_ADVANCE = 8;

// Guard against millisecond jitter
const STRICT_GUARD_MS = 1500;

// Root-solving
const SOLVE_MAX_ITERS = 70;
const SOLVE_EPS_MS = 500; // ~0.5s is plenty for “minute-level” products
const MONO_EPS_AU = 1e-10;

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

type ApsisKind = 'Perihelion' | 'Aphelion';

type Apsis = {
    kind: any;
    time: { date: Date };
    dist_au?: number;
};

function normalizeKind(k: any): ApsisKind | null {
    if (k === 0) return 'Perihelion';
    if (k === 1) return 'Aphelion';
    if (k === 'Perihelion' || k === 'Aphelion') return k;
    if (typeof k === 'string') {
        const kk = k.toLowerCase();
        if (kk === 'perihelion') return 'Perihelion';
        if (kk === 'aphelion') return 'Aphelion';
    }
    return null;
}

function kindOf(a: any): ApsisKind | null {
    return normalizeKind(a?.kind);
}

// ---------------------------------------------
// Distance helpers (Earth–Sun distance in AU)
// ---------------------------------------------

function earthSunDistanceAu(ts: number): number {
    const A: any = Astronomy as any;
    const d = new Date(ts);
    const t = toAstroTime(A, d);

    // Best: helio vector length
    try {
        if (typeof A.HelioVector === 'function') {
            const v = A.HelioVector(Astronomy.Body.Earth, t);
            if (v && typeof v.Length === 'function') return v.Length();
            if (v && typeof v.length === 'number') return v.length;
            if (v && typeof v.x === 'number') {
                const r = Math.hypot(v.x, v.y, v.z);
                if (Number.isFinite(r)) return r;
            }
        }
    } catch {}

    // Alt: direct helper
    try {
        if (typeof A.HelioDistance === 'function') {
            const r = A.HelioDistance(Astronomy.Body.Earth, t);
            if (typeof r === 'number' && Number.isFinite(r)) return r;
        }
    } catch {}

    return NaN;
}

function distDump(label: string, ts: number) {
    return { label, ts: fmt(ts), r_au: earthSunDistanceAu(ts) };
}

function distOrComputeAu(a: Apsis): number {
    const d = a?.dist_au;
    if (typeof d === 'number' && Number.isFinite(d)) return d;
    return earthSunDistanceAu(tsOf(a));
}

// ---------------------------------------------
// Apsis search (astronomy-engine) + walker
// ---------------------------------------------

function safeSearch(probe: Date): Apsis | null {
    try {
        const a = (Astronomy as any).SearchPlanetApsis(Astronomy.Body.Earth, probe) as Apsis;
        const t = a?.time?.date?.getTime?.();
        return typeof t === 'number' && Number.isFinite(t) ? a : null;
    } catch {
        return null;
    }
}

function safeNext(cur: Apsis): Apsis | null {
    try {
        const a = (Astronomy as any).NextPlanetApsis(cur as any) as Apsis;
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

function prevAphelionBefore(a: Apsis) {
    return walker.searchPrevApsisOfKind(tsOf(a) - STRICT_GUARD_MS, 'Aphelion');
}

// ---------------------------------------------
// Distance-linear spokes builder (around Aphelion A0)
// ---------------------------------------------

function buildDistanceLinearSpokesFromAphelion(A0: Apsis): Anchors | null {
    const tA0 = tsOf(A0);

    return group(`buildCycle A0=${fmt(tA0)}`, () => {
        // We need:
        // - P_before (previous Perihelion)
        // - P_after  (Perihelion after this Aphelion)
        // - A_after  (next Aphelion)
        const P_before = walker.searchPrevApsisOfKind(tA0 - STRICT_GUARD_MS, 'Perihelion');

        const approxHalf = ANOMALISTIC_YEAR_MS / 2;
        const approxFull = ANOMALISTIC_YEAR_MS;

        const P_after = walker.searchApsisNear(tA0 + approxHalf, 'Perihelion', ANOMALISTIC_YEAR_MS);
        if (!P_after || kindOf(P_after) !== 'Perihelion') {
            warn('P_after not found via approx search', fmt(tA0 + approxHalf));
            return null;
        }

        const A_after = walker.searchApsisNear(tA0 + approxFull, 'Aphelion', ANOMALISTIC_YEAR_MS);
        if (!A_after || kindOf(A_after) !== 'Aphelion') {
            warn('A_after not found via approx search', fmt(tA0 + approxFull));
            return null;
        }

        if (!P_before) {
            warn('missing P_before', { A0: fmt(tA0) });
            return null;
        }

        const tPb = tsOf(P_before);
        const tPa = tsOf(P_after);
        const tAa = tsOf(A_after);

        // Distances: max at aphelion, min at perihelion
        const rMax = distOrComputeAu(A0);      // Aphelion
        const rMin = distOrComputeAu(P_after); // Perihelion after A0 (this is S)

        log('apsis + distances', {
            tPb: fmt(tPb),
            tA0: fmt(tA0),
            tPa: fmt(tPa),
            tAa: fmt(tAa),
            rPb_au: earthSunDistanceAu(tPb),
            rA0_au: earthSunDistanceAu(tA0),
            rPa_au: earthSunDistanceAu(tPa),
            rAa_au: earthSunDistanceAu(tAa),
            rMin_au: rMin,
            rMid_au: (rMin + rMax) / 2,
            rMax_au: rMax,
        });

        log('bracket endpoints', {
            Pb: distDump('Pb', tPb),
            A0: distDump('A0', tA0),
            Pa: distDump('Pa', tPa),
            Aa: distDump('Aa', tAa),
        });

        const anchors = buildDistanceLinearWheel(
            {
                distanceAt: earthSunDistanceAu,
                SOLVE_MAX_ITERS,
                SOLVE_EPS_MS,
                MONO_EPS: MONO_EPS_AU,
                fmtTs: fmt,
                dbg: { log, warn },
            },
            {
                // E solve segment: P_before -> A0 (increasing)
                tE_guess_lo: tPb,
                tE_guess_hi: tA0,

                // N is aphelion itself
                tN: tA0,

                // W solve segment end: A0 -> P_after (decreasing)
                tW_guess_hi: tPa,

                // S is perihelion after A0
                tS: tPa,

                // E_next solve segment end: P_after -> A_after (increasing)
                tE_next_guess_hi: tAa,

                rMax,
                rMin,
                dbgLabel: 'solarAnomalistic',
            },
        );

        if (!anchors) return null;

        const spanDays = (anchors.E_next - anchors.E) / DAY_MS;
        if (!(spanDays > 200 && spanDays < 500)) {
            warn('distance-linear: suspicious span', spanDays.toFixed(3), 'days', {
                E: fmt(anchors.E),
                E_next: fmt(anchors.E_next),
            });
            return null;
        }

        log('solarAnomalistic distance-linear cycle', {
            E: fmt(anchors.E),
            N: fmt(anchors.N),
            W: fmt(anchors.W),
            S: fmt(anchors.S),
            E_next: fmt(anchors.E_next),
            rMin_au: rMin,
            rMid_au: (rMin + rMax) / 2,
            rMax_au: rMax,
        });

        return anchors;
    });
}

// ---------------------------------------------
// Approx fallback (simple, but stable)
// ---------------------------------------------

// Reference aphelion ~ July 4, 2000
const APPROX_EPOCH_APHELION_MS = Date.UTC(2000, 6, 4, 0, 0, 0, 0);

function approxAnchors(ts: number): Anchors {
    // Time-based approximation only (kept for fallback).
    const period = ANOMALISTIC_YEAR_MS;
    const half = period / 2;

    const k = Math.floor((ts - APPROX_EPOCH_APHELION_MS) / period);
    let A0 = APPROX_EPOCH_APHELION_MS + k * period;
    while (A0 > ts) A0 -= period;
    while (A0 + period <= ts) A0 += period;
    A0 = ms(A0);

    const P_before = ms(A0 - half);
    const P_after = ms(A0 + half);
    const A_after = ms(A0 + period);

    const E = ms((P_before + A0) / 2);
    const N = A0;
    const W = ms((A0 + P_after) / 2);
    const S = P_after;
    const E_next = ms((P_after + A_after) / 2);

    return { start: E, end: E_next, E, N, W, S, E_next };
}

// ---------------------------------------------
// Public API
// ---------------------------------------------

export function getSolarAnomalisticAnchors(ts: number): Anchors {
    if (!isFiniteNumber(ts)) return approxAnchors(Date.now());
    const M = ms(ts);

    return group(`M=${fmt(M)}`, () => {
        if (!inExactRange(M, EXACT_MIN_YEAR, EXACT_MAX_YEAR)) {
            warn('out of exact range → approx', fmt(M));
            return approxAnchors(M);
        }

        // Find previous aphelion <= M
        let A = walker.searchPrevApsisOfKind(M + STRICT_GUARD_MS, 'Aphelion');
        if (!A) {
            warn('Aphelion not found → approx', fmt(M));
            return approxAnchors(M);
        }

        for (let hop = 0; hop < MAX_CYCLE_ADVANCE; hop++) {
            const c = buildDistanceLinearSpokesFromAphelion(A);
            if (!c) {
                warn('cycle build failed → approx', { A: fmt(tsOf(A)), M: fmt(M) });
                return approxAnchors(M);
            }

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

            if (M < c.start) {
                log('rewind to previous cycle');
                const prev = prevAphelionBefore(A);
                if (!prev) break;
                A = prev;
            } else {
                log('advance to next cycle');
                const next = walker.nextApsisOfKind(A, 'Aphelion');
                if (!next) break;
                A = next;
            }
        }

        warn('MAX_CYCLE_ADVANCE reached → approx');
        return approxAnchors(M);
    }) as Anchors;
}

export const angleFromSolarAnomalisticAnchors = angleFromAnchors;
