// src/lib/cycle/spokes.ts
//
// Spokes + anchors utilities.
//
// Change:
// - Anchors can optionally include already-computed timestamps for any/all spokes.
// - buildSpokeTimes() will use those precomputed values when they are present and valid,
//   otherwise it falls back to linear interpolation between E/N/W/S.
//
// Order (indices 0..16):
// E, ENE, NE, NNE, N, NNW, NW, WNW, W, WSW, SW, SSW, S, SSE, SE, ESE, E_next

import {type SpokeKey, SPOKES_ORDER} from "./types";
import {isFiniteNumber} from "../math/helpers";

export type Anchors = {
    start: number;
    end: number;

    E: number;
    N: number;
    W: number;
    S: number;

    E_next: number;

    /**
     * Optional: precomputed spoke times.
     * If a cycle computes some or all spokes precisely (e.g. distance-equalized spokes),
     * it can provide them here.
     *
     * - You can provide just a few (e.g. only ENE/NE/...).
     * - If you provide ALL 17 keys, buildSpokeTimes() will use them as-is (after sanity checks).
     * - If partial, buildSpokeTimes() will fill the missing ones by interpolating within segments.
     */
    spokes?: Partial<Record<SpokeKey, number>>;
};

function fillSegment(times: number[], startIndex: number, startTs: number, endTs: number) {
    const seg = endTs - startTs;
    for (let k = 0; k <= 4; k++) {
        times[startIndex + k] = startTs + (seg * k) / 4;
    }
}

function fillAllByInterpolation(a: Anchors) {
    const times = new Array<number>(17);

    fillSegment(times, 0, a.E, a.N);        // E -> N : 0..4
    fillSegment(times, 4, a.N, a.W);        // N -> W : 4..8
    fillSegment(times, 8, a.W, a.S);        // W -> S : 8..12
    fillSegment(times, 12, a.S, a.E_next);  // S -> E+ : 12..16

    return times;
}

function sanityMonotonic(times: number[]) {
    if (times.length !== 17) return false;
    for (let i = 0; i < 16; i++) {
        if (!(isFiniteNumber(times[i]) && isFiniteNumber(times[i + 1]) && times[i] < times[i + 1])) {
            return false;
        }
    }
    return true;
}

/**
 * 0..16 timestamps (16 == E_next). Indices correspond to:
 * E, ENE, NE, NNE, N, NNW, NW, WNW, W, WSW, SW, SSW, S, SSE, SE, ESE, E_next
 */
export function buildSpokeTimes(a: Anchors) {
    const base = fillAllByInterpolation(a);

    const s = a.spokes;
    if (!s) return base;

    // Put provided values in place (if valid).
    for (let i = 0; i < SPOKES_ORDER.length; i++) {
        const key = SPOKES_ORDER[i];
        const v = s[key];
        if (isFiniteNumber(v)) base[i] = v;
    }

    // If user provided a FULL set, we require monotonic sanity.
    let full = true;
    for (let i = 0; i < SPOKES_ORDER.length; i++) {
        if (!isFiniteNumber(s[SPOKES_ORDER[i]])) {
            full = false;
            break;
        }
    }

    if (full) {
        // Full override: accept only if it is strictly increasing.
        if (sanityMonotonic(base)) return base;
        // If it's broken, fall back to pure interpolation.
        return fillAllByInterpolation(a);
    }

    // Partial override: keep provided values, but re-interpolate missing ones inside each segment
    // using the nearest known endpoints for that segment.
    //
    // Segment index ranges (inclusive endpoints):
    // 0..4 (E..N), 4..8 (N..W), 8..12 (W..S), 12..16 (S..E_next)
    const segs: Array<[number, number]> = [
        [0, 4],
        [4, 8],
        [8, 12],
        [12, 16],
    ];

    // Helper: fill missing values between two indices using linear interpolation
    // between existing endpoints at i0 and i1 (must exist).
    function fillBetween(i0: number, i1: number) {
        const t0 = base[i0];
        const t1 = base[i1];
        const n = i1 - i0;
        if (!(isFiniteNumber(t0) && isFiniteNumber(t1) && n > 0)) return;

        for (let k = 0; k <= n; k++) {
            const idx = i0 + k;
            if (!isFiniteNumber(s?.[SPOKES_ORDER[idx]])) {
                base[idx] = t0 + (t1 - t0) * (k / n);
            }
        }
    }

    for (const [lo, hi] of segs) {
        // Ensure endpoints are sane: if caller set them, use; otherwise base already has interpolated anchors.
        // Now fill interior gaps between consecutive "known" points within the segment.
        let lastKnown = lo;

        for (let i = lo; i <= hi; i++) {
            const key = SPOKES_ORDER[i];
            const isKnown = isFiniteNumber(s[key]);
            if (i === lo) {
                lastKnown = lo;
                continue;
            }
            if (isKnown) {
                fillBetween(lastKnown, i);
                lastKnown = i;
            }
        }
        // Fill from lastKnown to segment end.
        if (lastKnown !== hi) fillBetween(lastKnown, hi);
    }

    // Final safety: we should still be monotonic. If not, revert.
    if (!sanityMonotonic(base)) return fillAllByInterpolation(a);

    return base;
}
