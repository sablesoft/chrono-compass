// src/lib/math/extrema.ts
//
// Generic local extrema search for a smooth-ish scalar function f(ts).
// We use:
// - adaptive window sampling to detect candidate extrema
// - golden-section refinement inside [t_{i-1}, t_{i+1}] bracket
//
// This is intentionally generic (no planet-specific logic).

import {DAY_MS, isFiniteNumber} from "./helpers";

// ----------------------
export type Ext = {
    t: number;
    v: number;
};

export type FindWindowExtremumOpts = {
    stepMs: number;
    refineIters?: number;
    dbg?: {
        log?: (...a: any[]) => void;
    };
};

/**
 * Ищет ЛЮБОЙ экстремум в интервале
 * (center - halfWindow, center + halfWindow).
 *
 * Предполагается: в окне максимум один экстремум.
 * Возвращает его либо null.
 */
export function findExtremumInWindow(
    f: (t: number) => number,
    center: number,
    halfWindow: number,
    opts: FindWindowExtremumOpts
): Ext | null {
    const { stepMs, refineIters = 20, dbg } = opts;

    const tStart = center - halfWindow;
    const tEnd   = center + halfWindow;

    let tPrev = tStart;
    let vPrev = f(tPrev);
    if (!isFiniteNumber(vPrev)) return null;

    let slopePrev: number | null = null;

    for (let t = tStart + stepMs; t <= tEnd; t += stepMs) {
        const v = f(t);
        if (!isFiniteNumber(v)) continue;

        const slope = v - vPrev;

        if (slopePrev !== null) {
            // смена направления
            if ((slopePrev > 0 && slope < 0) || (slopePrev < 0 && slope > 0)) {

                const refined = refineExtremum(
                    f,
                    t - stepMs,
                    t + stepMs,
                    refineIters
                );

                if (!refined) return null;

                dbg?.log?.('bind.window.extremum', {
                    center: new Date(center).toISOString(),
                    found: new Date(refined.t).toISOString(),
                    value: refined.v
                });

                return refined; // сразу возвращаем первый найденный
            }
        }

        slopePrev = slope;
        tPrev = t;
        vPrev = v;
    }

    return null;
}

function refineExtremum(
    f: (t: number) => number,
    t0: number,
    t1: number,
    iters: number
): Ext | null {
    let a = t0;
    let b = t1;

    for (let i = 0; i < iters; i++) {
        const mid = (a + b) / 2;

        const vLeft  = f(mid - 1);
        const vMid   = f(mid);
        const vRight = f(mid + 1);

        if (!isFiniteNumber(vLeft) || !isFiniteNumber(vMid) || !isFiniteNumber(vRight))
            return null;

        if (vLeft < vMid && vRight < vMid) {
            // максимум
            a = mid - (b - a) / 4;
            b = mid + (b - a) / 4;
        } else if (vLeft > vMid && vRight > vMid) {
            // минимум
            a = mid - (b - a) / 4;
            b = mid + (b - a) / 4;
        } else {
            a = (a + mid) / 2;
            b = (mid + b) / 2;
        }
    }

    const t = (a + b) / 2;
    const v = f(t);
    if (!isFiniteNumber(v)) return null;

    return { t, v };
}

type ExtKind = 'min' | 'max';
export type ExtHit = { e: Ext; kind: ExtKind };

function goldenSearch(
    f: (t: number) => number,
    a0: number,
    b0: number,
    want: ExtKind,
    epsMs: number
): Ext | null {
    let a = a0, b = b0;
    const phi = (1 + Math.sqrt(5)) / 2;
    const invPhi = 1 / phi;

    let c = b - (b - a) * invPhi;
    let d = a + (b - a) * invPhi;
    let fc = f(c);
    let fd = f(d);

    if (!isFiniteNumber(fc) || !isFiniteNumber(fd)) return null;

    while ((b - a) > epsMs) {
        const pickLeft = want === 'min' ? (fc < fd) : (fc > fd);

        if (pickLeft) {
            b = d;
            d = c;
            fd = fc;
            c = b - (b - a) * invPhi;
            fc = f(c);
        } else {
            a = c;
            c = d;
            fc = fd;
            d = a + (b - a) * invPhi;
            fd = f(d);
        }

        if (!isFiniteNumber(fc) || !isFiniteNumber(fd)) return null;
    }

    const t = (a + b) / 2;
    const v = f(t);
    if (!isFiniteNumber(v)) return null;
    return { t, v };
}

export function findExtremumInWindowGold(
    f: (t: number) => number,
    center: number,
    halfWindow: number,
    opts: { epsMs?: number; probeMs?: number; dbg?: { log?: (...a:any[])=>void } } = {}
): Ext | null {

    const epsMs = opts.epsMs ?? 60_000;                 // 1 min accuracy
    const probeMs = opts.probeMs ?? Math.max(5*60_000, epsMs); // validate around point
    const dbg = opts.dbg;

    const a = center - halfWindow;
    const b = center + halfWindow;

    const fa = f(a);
    const fb = f(b);
    if (!isFiniteNumber(fa) || !isFiniteNumber(fb)) return null;

    const minExt = goldenSearch(f, a, b, 'min', epsMs);
    const maxExt = goldenSearch(f, a, b, 'max', epsMs);

    function isRealMin(e: Ext | null): e is Ext {
        if (!e) return false;
        const vL = f(e.t - probeMs);
        const vR = f(e.t + probeMs);
        if (!isFiniteNumber(vL) || !isFiniteNumber(vR)) return false;
        const v0 = e.v;
        // must be strictly below neighbors AND below both ends
        return v0 < vL && v0 < vR && v0 < fa && v0 < fb;
    }
    function isRealMax(e: Ext | null): e is Ext {
        if (!e) return false;
        const vL = f(e.t - probeMs);
        const vR = f(e.t + probeMs);
        if (!isFiniteNumber(vL) || !isFiniteNumber(vR)) return false;
        const v0 = e.v;
        return v0 > vL && v0 > vR && v0 > fa && v0 > fb;
    }

    const okMin = isRealMin(minExt);
    const okMax = isRealMax(maxExt);

    if (okMin && okMax) {
        // окно явно содержит больше структуры, чем “≤1 экстремум”
        dbg?.log?.('bind.ext.any.ambiguous', { center: fmt(center), halfWindow, min: minExt, max: maxExt });
        return null;
    }
    if (!okMin && !okMax) return null;

    const hit: ExtHit = okMin ? { e: minExt, kind: 'min' } : { e: maxExt!, kind: 'max' };

    dbg?.log?.('bind.ext.any', {
        center: fmt(center),
        halfWinDays: (halfWindow / DAY_MS).toFixed(3),
        found: { t: fmt(hit.e.t), v: hit.e.v, kind: hit.kind },
    });

    return hit.e ?? null;
}

export function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}
