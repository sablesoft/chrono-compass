// src/lib/cycles/distanceLinearCore.ts
import { ms } from '../format';
import { type Anchors, type SpokeKey, SPOKES_ORDER } from '../wheel/spokes';

type Dbg = {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
};

export type DistanceLinearParams = {
    // distance(t) in chosen units
    distanceAt: (ts: number) => number;

    // solver params
    SOLVE_MAX_ITERS: number;
    SOLVE_EPS_MS: number;
    MONO_EPS: number;

    // pretty formatting (optional)
    fmtTs?: (ts: number) => string;

    dbg?: Dbg;
};

export function solveTimeForDistance(
    p: DistanceLinearParams,
    t0: number,
    t1: number,
    target: number,
    increasing: boolean,
    label: string,
): number | null {
    const { distanceAt, SOLVE_MAX_ITERS, SOLVE_EPS_MS, MONO_EPS, dbg, fmtTs } = p;

    let lo = ms(Math.min(t0, t1));
    let hi = ms(Math.max(t0, t1));

    const rLo0 = distanceAt(lo);
    const rHi0 = distanceAt(hi);

    if (!Number.isFinite(rLo0) || !Number.isFinite(rHi0)) {
        dbg?.warn?.('solveTimeForDistance: bad distance fn', { label, target, lo: fmtTs?.(lo) ?? lo, rLo0, hi: fmtTs?.(hi) ?? hi, rHi0 });
        return null;
    }

    const minR = Math.min(rLo0, rHi0) - MONO_EPS;
    const maxR = Math.max(rLo0, rHi0) + MONO_EPS;
    if (!(target >= minR && target <= maxR)) {
        dbg?.warn?.('solveTimeForDistance: target not bracketed', { label, target, lo: fmtTs?.(lo) ?? lo, rLo0, hi: fmtTs?.(hi) ?? hi, rHi0, minR, maxR, increasing });
        return null;
    }

    for (let i = 0; i < SOLVE_MAX_ITERS; i++) {
        const mid = ms((lo + hi) / 2);
        const rMid = distanceAt(mid);
        if (!Number.isFinite(rMid)) return null;

        if ((hi - lo) <= SOLVE_EPS_MS) return mid;

        if (increasing) {
            if (rMid < target) lo = mid;
            else hi = mid;
        } else {
            if (rMid > target) lo = mid;
            else hi = mid;
        }
    }

    return ms((lo + hi) / 2);
}

export type BuildDistanceLinearWheelArgs = {
    // endpoints
    tE_guess_lo: number; // segment start for E solve (e.g. P_before)
    tE_guess_hi: number; // segment end for E solve   (e.g. A0)
    tN: number;          // max distance apsis time
    tW_guess_hi: number; // segment end for W solve   (e.g. P_after)
    tS: number;          // min distance apsis time
    tE_next_guess_hi: number; // segment end for E_next solve (e.g. A_after)

    rMax: number;
    rMin: number;

    dbgLabel?: string;
};

export function buildDistanceLinearWheel(
    p: DistanceLinearParams,
    a: BuildDistanceLinearWheelArgs,
): Anchors | null {
    const { dbg, fmtTs } = p;
    const { tE_guess_lo, tE_guess_hi, tN, tW_guess_hi, tS, tE_next_guess_hi, rMax, rMin } = a;

    const rMid = (rMin + rMax) / 2;

    const dd = (label: string, ts: number) => ({ label, ts: fmtTs?.(ts) ?? ts, r: p.distanceAt(ts), target: rMid });

    dbg?.log?.('bracket E', { ...dd('lo', tE_guess_lo), ...dd('hi', tE_guess_hi) });
    const tE = solveTimeForDistance(p, tE_guess_lo, tE_guess_hi, rMid, true, 'E (rMid)');
    if (tE == null) { dbg?.warn?.('failed E solve'); return null; }

    dbg?.log?.('bracket W', { ...dd('lo', tN), ...dd('hi', tW_guess_hi) });
    const tW = solveTimeForDistance(p, tN, tW_guess_hi, rMid, false, 'W (rMid)');
    if (tW == null) { dbg?.warn?.('failed W solve'); return null; }

    dbg?.log?.('bracket E_next', { ...dd('lo', tS), ...dd('hi', tE_next_guess_hi) });
    const tE2 = solveTimeForDistance(p, tS, tE_next_guess_hi, rMid, true, 'E_next (rMid)');
    if (tE2 == null) { dbg?.warn?.('failed E_next solve'); return null; }

    if (!(tE < tN && tN < tW && tW < tS && tS < tE2)) {
        dbg?.warn?.('distance-linear: bad main ordering', { tE, tN, tW, tS, tE2 });
        return null;
    }

    function distStep(x0: number, x1: number, k: number) {
        return x0 + (x1 - x0) * (k / 4);
    }

    const spokes: Partial<Record<SpokeKey, number>> = {};

    // Q1: E -> N, inc rMid -> rMax
    spokes.E = tE;
    spokes.ENE = solveTimeForDistance(p, tE, tN, distStep(rMid, rMax, 1), true, 'ENE') ?? undefined;
    spokes.NE  = solveTimeForDistance(p, tE, tN, distStep(rMid, rMax, 2), true, 'NE')  ?? undefined;
    spokes.NNE = solveTimeForDistance(p, tE, tN, distStep(rMid, rMax, 3), true, 'NNE') ?? undefined;
    spokes.N = tN;

    // Q2: N -> W, dec rMax -> rMid
    spokes.NNW = solveTimeForDistance(p, tN, tW, distStep(rMax, rMid, 1), false, 'NNW') ?? undefined;
    spokes.NW  = solveTimeForDistance(p, tN, tW, distStep(rMax, rMid, 2), false, 'NW')  ?? undefined;
    spokes.WNW = solveTimeForDistance(p, tN, tW, distStep(rMax, rMid, 3), false, 'WNW') ?? undefined;
    spokes.W = tW;

    // Q3: W -> S, dec rMid -> rMin
    spokes.WSW = solveTimeForDistance(p, tW, tS, distStep(rMid, rMin, 1), false, 'WSW') ?? undefined;
    spokes.SW  = solveTimeForDistance(p, tW, tS, distStep(rMid, rMin, 2), false, 'SW')  ?? undefined;
    spokes.SSW = solveTimeForDistance(p, tW, tS, distStep(rMid, rMin, 3), false, 'SSW') ?? undefined;
    spokes.S = tS;

    // Q4: S -> E_next, inc rMin -> rMid
    spokes.SSE = solveTimeForDistance(p, tS, tE2, distStep(rMin, rMid, 1), true, 'SSE') ?? undefined;
    spokes.SE  = solveTimeForDistance(p, tS, tE2, distStep(rMin, rMid, 2), true, 'SE')  ?? undefined;
    spokes.ESE = solveTimeForDistance(p, tS, tE2, distStep(rMin, rMid, 3), true, 'ESE') ?? undefined;
    spokes.E_next = tE2;

    const allComputed = SPOKES_ORDER.every((k) => {
        if (k === 'E' || k === 'N' || k === 'W' || k === 'S' || k === 'E_next') return true;
        return typeof spokes[k] === 'number' && Number.isFinite(spokes[k] as number);
    });

    if (allComputed) {
        const seq = SPOKES_ORDER.map((k) => {
            const v =
                k === 'E' ? tE :
                    k === 'N' ? tN :
                        k === 'W' ? tW :
                            k === 'S' ? tS :
                                k === 'E_next' ? tE2 :
                                    spokes[k];
            return ms(v ?? NaN);
        });

        for (let i = 0; i < seq.length - 1; i++) {
            if (!(seq[i] < seq[i + 1])) {
                dbg?.warn?.('distance-linear: non-increasing sequence', { i, a: fmtTs?.(seq[i]) ?? seq[i], b: fmtTs?.(seq[i + 1]) ?? seq[i + 1] });
                return null;
            }
        }
    }

    // noinspection UnnecessaryLocalVariableJS
    const anchors: Anchors = {
        start: tE,
        end: tE2,
        E: tE,
        N: tN,
        W: tW,
        S: tS,
        E_next: tE2,
        spokes,
    };

    return anchors;
}