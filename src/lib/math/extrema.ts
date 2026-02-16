// src/lib/math/extrema.ts
//
// Generic local extrema search for a smooth-ish scalar function f(ts).
// We use:
// - adaptive window sampling to detect candidate extrema
// - golden-section refinement inside [t_{i-1}, t_{i+1}] bracket
//
// This is intentionally generic (no planet-specific logic).

import {clamp, isFiniteNumber} from "./helpers";

export type ExtremaKind = 'max' | 'min';

export type FindExtremaOpts = {
    // initial sampling window around t0 (ms)
    windowMs?: number;
    // initial step (ms)
    stepMs?: number;

    // max window expansion (ms)
    maxWindowMs?: number;

    // refinement iterations for golden search
    refineIters?: number;

    // debug hooks
    dbg?: { log?: (...a: any[]) => void; warn?: (...a: any[]) => void };
};

const DAY_MS = 86_400_000;

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

type Sample = { t: number; v: number };

/**
 * Golden-section search for extremum (min or max) on [a,b].
 * Assumes unimodal-ish within the bracket.
 */
function refineExtremumGolden(
    f: (t: number) => number,
    kind: ExtremaKind,
    a0: number,
    b0: number,
    iters: number,
): { t: number; v: number } {
    let a = Math.min(a0, b0);
    let b = Math.max(a0, b0);

    // Golden ratio constants
    const gr = (Math.sqrt(5) - 1) / 2; // ~0.618
    let c = b - gr * (b - a);
    let d = a + gr * (b - a);

    let fc = f(c);
    let fd = f(d);

    for (let i = 0; i < iters; i++) {
        // For max, invert comparisons
        const pickLeft =
            kind === 'min'
                ? fc < fd
                : fc > fd;

        if (pickLeft) {
            b = d;
            d = c;
            fd = fc;
            c = b - gr * (b - a);
            fc = f(c);
        } else {
            a = c;
            c = d;
            fc = fd;
            d = a + gr * (b - a);
            fd = f(d);
        }
    }

    const t = (a + b) / 2;
    const v = f(t);
    return { t, v };
}

/**
 * Find nearest local extremum (max/min) to t0.
 * Returns null if cannot find within expansion limits.
 */
export function findNearestExtremum(
    f: (t: number) => number,
    t0: number,
    kind: ExtremaKind,
    opts: FindExtremaOpts = {},
): { t: number; v: number } | null {
    const dbg = opts.dbg;
    const refineIters = opts.refineIters ?? 28;

    let windowMs = opts.windowMs ?? 120 * DAY_MS;
    let stepMs = opts.stepMs ?? 12 * 3_600_000; // 12h
    const maxWindowMs = opts.maxWindowMs ?? 5000 * DAY_MS;

    // Adaptive expansion until we find at least one candidate
    for (let round = 0; round < 12; round++) {
        const lo = t0 - windowMs;
        const hi = t0 + windowMs;

        const steps = Math.max(24, Math.floor((hi - lo) / stepMs));
        const dt = (hi - lo) / steps;

        const samples: Sample[] = [];
        for (let i = 0; i <= steps; i++) {
            const t = lo + i * dt;
            const v = f(t);
            if (isFiniteNumber(v)) samples.push({ t, v });
        }

        if (samples.length < 5) {
            dbg?.warn?.('findNearestExtremum: too few samples', { round, windowMs, stepMs });
            windowMs *= 2;
            stepMs *= 1.25;
            if (windowMs > maxWindowMs) break;
            continue;
        }

        // Detect candidates using slope sign change:
        // max: + then -
        // min: - then +
        const cand: { idx: number; score: number }[] = [];
        for (let i = 1; i < samples.length - 1; i++) {
            const a = samples[i - 1];
            const b = samples[i];
            const c = samples[i + 1];

            const d1 = b.v - a.v;
            const d2 = c.v - b.v;

            if (kind === 'max') {
                if (d1 > 0 && d2 < 0) {
                    cand.push({ idx: i, score: Math.abs(d1) + Math.abs(d2) });
                }
            } else {
                if (d1 < 0 && d2 > 0) {
                    cand.push({ idx: i, score: Math.abs(d1) + Math.abs(d2) });
                }
            }
        }

        if (!cand.length) {
            dbg?.log?.('findNearestExtremum: no candidates, expand', { round, windowMs, stepMs });
            windowMs *= 2;
            // keep step not too fine when window grows
            stepMs = clamp(stepMs * 1.35, 6 * 3_600_000, 5 * DAY_MS);
            if (windowMs > maxWindowMs) break;
            continue;
        }

        // Choose candidate nearest to t0 (with slight preference to stronger score)
        cand.sort((p, q) => {
            const tp = samples[p.idx].t;
            const tq = samples[q.idx].t;
            const dp = Math.abs(tp - t0);
            const dq = Math.abs(tq - t0);
            if (dp !== dq) return dp - dq;
            return q.score - p.score;
        });

        const iBest = cand[0].idx;
        const tMid = samples[iBest].t;

        // bracket [i-1, i+1]
        const a = samples[Math.max(0, iBest - 1)].t;
        const b = samples[Math.min(samples.length - 1, iBest + 1)].t;

        const refined = refineExtremumGolden(f, kind, a, b, refineIters);

        dbg?.log?.('findNearestExtremum: ok', {
            kind,
            t0: fmt(t0),
            windowDays: (windowMs / DAY_MS).toFixed(1),
            stepHours: (stepMs / 3_600_000).toFixed(1),
            approx: fmt(tMid),
            refined: fmt(refined.t),
            v: refined.v,
        });

        return refined;
    }

    dbg?.warn?.('findNearestExtremum: failed', { kind, t0: fmt(t0) });
    return null;
}

/**
 * Find next local extremum after tStart (direction +1) or before (direction -1).
 * We do nearest-extremum search around shifted center, then ensure it's on the correct side.
 */
export function findExtremumInDirection(
    f: (t: number) => number,
    tStart: number,
    kind: ExtremaKind,
    direction: 1 | -1,
    opts: FindExtremaOpts = {},
): { t: number; v: number } | null {
    const dbg = opts.dbg;

    // We bias the search center forward/backward by a fraction of the window
    const baseWindow = opts.windowMs ?? 120 * DAY_MS;
    const bias = Math.max(2 * DAY_MS, baseWindow * 0.35);

    const center = tStart + direction * bias;

    const e = findNearestExtremum(f, center, kind, opts);
    if (!e) return null;

    // Ensure it's strictly in requested direction; if not, try expanding center more
    if (direction === 1 && e.t <= tStart) {
        dbg?.log?.('findExtremumInDirection: extremum not after, retry', { kind, tStart, got: e.t });
        return findNearestExtremum(f, tStart + direction * baseWindow, kind, {
            ...opts,
            windowMs: baseWindow * 1.5,
        });
    }
    if (direction === -1 && e.t >= tStart) {
        dbg?.log?.('findExtremumInDirection: extremum not before, retry', { kind, tStart, got: e.t });
        return findNearestExtremum(f, tStart + direction * baseWindow, kind, {
            ...opts,
            windowMs: baseWindow * 1.5,
        });
    }

    return e;
}
