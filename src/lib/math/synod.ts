// src/lib/math/synod.ts
//
// Unified Synod wheel solver (phase-angular, 17 spokes) for any (looker, focus, target)
// where focus is the VERTEX of the angle.
//
// v5.1 (DIRECTED-CROSSING BOUNDARIES, ASYMMETRIC SEARCH) — UPDATED ONTOLOGY:
// - looker = external observer direction (defines S direction)
// - focus  = vertex of the angle (center of wheel geometry)
// - target = rotates around focus relative to looker
//
// Geometry:
//   uL = dir(focus -> looker)
//   uT = dir(focus -> target)
//   φ  = lon(uT) - lon(uL)   in [0..360)
//   S = focus - target - looker  => φ ~ 0
//   N = target - focus - looker  => φ ~ 180
//
// Boundaries/spokes:
// - E and E_next are searched separately:
//     E      = nearest directed θ=90° crossing at/before ts (expand backwards)
//     E_next = nearest directed θ=90° crossing after ts     (expand forwards)
// - Unwrap remains anchored at E time; spokes solved by bisection on θ_unwrap.
//
// Output rounding:
// - ALL solving/validation uses exact timestamps (no rounding).
// - Only final spoke.ts is rounded to minutes, with monotonic enforcement.
//
// Unified Synod wheel solver (phase-angular, 17 spokes) for any (looker, focus, target)
// where focus is the VERTEX of the angle.
//
// v5.1 (DIRECTED-CROSSING BOUNDARIES, ASYMMETRIC SEARCH) — UPDATED ONTOLOGY:
// - looker = external observer direction (defines S direction)
// - focus  = vertex of the angle (center of wheel geometry)
// - target = rotates around focus relative to looker
//
// Geometry:
//   uL = dir(focus -> looker)
//   uT = dir(focus -> target)
//   φ  = lon(uT) - lon(uL)   in [0..360)
//   S = focus - target - looker  => φ ~ 0
//   N = target - focus - looker  => φ ~ 180
//
// Boundaries/spokes:
// - E and E_next are searched separately:
//     E      = nearest directed θ=90° crossing at/before ts (expand backwards)
//     E_next = nearest directed θ=90° crossing after ts     (expand forwards)
// - Unwrap remains anchored at E time; spokes solved by bisection on θ_unwrap.
//
// Output rounding:
// - ALL solving/validation uses exact timestamps (no rounding).
// - Only final spoke.ts is rounded to minutes, with monotonic enforcement.
//
// PATCHES APPLIED (3):
// 1) Robust directed-crossing scan across NaN gaps (baseline reset) + no early-return on initial NaN.
// 2) Adaptive scan step fallback (halve step if crossingsCount==0 in a window).
// 3) Post-boundary window normalization to enforce invariant: E <= ts < E_next (shift to current cycle).

import * as Astronomy from 'astronomy-engine';
import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import type { ObjId, ObjKind, ReferenceMeta } from '../catalog';
import { objects } from '../catalog';
import type { SpokeKey } from '../wheel/types';
import { SPOKES_ORDER } from '../wheel/types';

import { AU_KM, clamp, DAY_MS, isFiniteNumber, lerp, norm360, toSigned180 } from './helpers';
import { refUnit, lonDegEcliptic, type Vec } from './vector';
import { fmt } from './extrema';

export type SynodMeta = {
    // distances (AU) from focus -> target / focus -> looker (lookerDistAu = NaN for reference looker)
    distanceAu: number;
    distanceKm: number;
    focusDistAu: number;
    exactTs?: number;
};

type SolveOpts = {
    maxIters?: number;
    epsMs?: number;
    dbg?: { log?: (...a: any[]) => void; warn?: (...a: any[]) => void };
};

type ObjRec = { id: ObjId; kind: ObjKind; meta?: any } | null;

function getObj(id: ObjId): ObjRec {
    const o = (objects as any)?.[id];
    return o ? (o as ObjRec) : null;
}

function toEngineBody(id: ObjId): any {
    return (Astronomy as any).Body?.[id as any] ?? (Astronomy as any).Body?.Sun;
}

function nearEq(a: number, b: number, epsAbs: number, epsRel: number) {
    const d = Math.abs(a - b);
    const s = Math.max(1, Math.abs(a), Math.abs(b));
    return d <= Math.max(epsAbs, epsRel * s);
}

function roundToMinuteMs(ts: number): number {
    return Math.round(ts / 60_000) * 60_000;
}

function roundToMinuteMonotonic(t: number[]): number[] {
    const out = t.map(roundToMinuteMs);
    for (let i = 1; i < out.length; i++) {
        if (out[i] < out[i - 1]) out[i] = out[i - 1];
    }
    return out;
}

function formatCycleDurationTag(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return '';
    let leftMin = Math.round(ms / 60_000);
    const MIN_PER_HOUR = 60;
    const MIN_PER_DAY = 24 * MIN_PER_HOUR;
    const MIN_PER_MONTH = 30 * MIN_PER_DAY;
    const MIN_PER_YEAR = 365 * MIN_PER_DAY;

    const year = Math.floor(leftMin / MIN_PER_YEAR); leftMin -= year * MIN_PER_YEAR;
    const month = Math.floor(leftMin / MIN_PER_MONTH); leftMin -= month * MIN_PER_MONTH;
    const day = Math.floor(leftMin / MIN_PER_DAY); leftMin -= day * MIN_PER_DAY;
    const hour = Math.floor(leftMin / MIN_PER_HOUR); leftMin -= hour * MIN_PER_HOUR;
    const min = leftMin;

    const parts: string[] = [];
    if (year) parts.push(`${year}y`);
    if (month) parts.push(`${month}mo`);
    if (day) parts.push(`${day}d`);
    if (hour) parts.push(`${hour}h`);
    if (min || parts.length === 0) parts.push(`${min}m`);
    return `cycle duration ${parts.join(' ')}`;
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

function synodSpokeTags(code: SpokeKey, durationTag: string): string[] {
    const codeTag = code === 'E_next' ? null : `${code}-synod`;
    return uniqueTags([
        codeTag,
        code === 'E' ? 'cycle start' : null,
        code === 'E' ? 'cycle end' : null,
        code === 'E' ? 'first quarter' : null,
        code === 'E' ? 'waxing quadrature' : null,
        code === 'N' ? 'opposition' : null,
        code === 'N' ? 'full phase' : null,
        code === 'W' ? 'last quarter' : null,
        code === 'W' ? 'waning quadrature' : null,
        code === 'S' ? 'conjunction' : null,
        code === 'S' ? 'new phase' : null,
        code === 'E' ? durationTag : null,
    ]);
}

// ---------------------------
// Engine position providers
// ---------------------------

function helioVec(id: ObjId, ts: number): Vec | null {
    const A: any = Astronomy as any;
    const t = new A.AstroTime(new Date(ts));

    if (id === 'Sun') return { x: 0, y: 0, z: 0 };

    try {
        if (typeof A.HelioVector === 'function') {
            const v = A.HelioVector(toEngineBody(id), t);
            if (v && isFiniteNumber(v.x) && isFiniteNumber(v.y) && isFiniteNumber(v.z)) {
                return { x: v.x, y: v.y, z: v.z };
            }
        }
    } catch {}

    // Moon fallback: Moon heliocentric = Earth heliocentric + Moon geocentric
    if (id === 'Moon') {
        try {
            const vE = helioVec('Earth' as ObjId, ts);
            if (!vE) return null;

            if (typeof (Astronomy as any).GeoVector === 'function') {
                const vM = (Astronomy as any).GeoVector(toEngineBody('Moon'), t, false);
                if (vM && isFiniteNumber(vM.x) && isFiniteNumber(vM.y) && isFiniteNumber(vM.z)) {
                    return { x: vE.x + vM.x, y: vE.y + vM.y, z: vE.z + vM.z };
                }
            }
        } catch {}
    }

    return null;
}

function sub(a: Vec, b: Vec): Vec {
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function norm(a: Vec): number {
    return Math.hypot(a.x, a.y, a.z);
}

function normalize(a: Vec): Vec | null {
    const m = norm(a);
    if (!(m > 0) || !isFiniteNumber(m)) return null;
    return { x: a.x / m, y: a.y / m, z: a.z / m };
}

// ---------------------------
// Direction from ORIGIN (focus) to obj
// ---------------------------

function dirFromOriginToEngine(origin: ObjId, obj: ObjId, ts: number): { u: Vec; distAu: number } | null {
    const pO = helioVec(origin, ts);
    const pB = helioVec(obj, ts);
    if (!pO || !pB) return null;

    const v = sub(pB, pO);
    const d = norm(v);
    const u = normalize(v);
    if (!u) return null;

    return { u, distAu: d };
}

// For far references we treat direction as fixed inertial unit vector.
// This ignores parallax from different origins, which is fine at this scale.
function dirFromOriginToReference(objId: ObjId): { u: Vec; distAu: number } | null {
    const o = getObj(objId);
    const meta = o?.meta as ReferenceMeta | undefined;
    if (!meta) return null;

    const u3 = refUnit(meta);
    if (!u3) return null;

    return { u: { x: u3[0], y: u3[1], z: u3[2] }, distAu: NaN };
}

function dirFromOrigin(origin: ObjId, obj: ObjId, ts: number): { u: Vec; distAu: number } | null {
    // IMPORTANT: focus/origin must be an engine body to define a real vertex position.
    // If origin is a reference, we cannot compute vectors reliably.
    const orec = getObj(origin);
    if (orec?.kind === 'reference') return null;

    const rec = getObj(obj);
    if (rec?.kind === 'reference') return dirFromOriginToReference(obj);
    return dirFromOriginToEngine(origin, obj, ts);
}

// ---------------------------
// Phase definition (vertex at focus; default ecliptic plane)
// ---------------------------

function phaseDeg(
    looker: ObjId,
    focus: ObjId,
    target: ObjId,
    ts: number,
): { phi: number; dT: number; dL: number } | null {
    // vectors are from focus -> looker/target (vertex at focus)
    const dL = dirFromOrigin(focus, looker, ts);
    const dT = dirFromOrigin(focus, target, ts);
    if (!dL || !dT) return null;

    const lonL = lonDegEcliptic(dL.u);
    const lonT = lonDegEcliptic(dT.u);

    // φ measures target relative to looker direction in the vertex frame
    const phi = norm360(lonT - lonL);

    return { phi, dT: dT.distAu, dL: dL.distAu };
}

// ---------------------------
// Direction detection + forward phase
// ---------------------------

function detectMotionDir(
    phiAt: (t: number) => number,
    ts: number,
): { motion: 'ccw' | 'cw'; speedDegPerDayAbs: number } | null {
    const dts = [30 * 60_000, 3 * 60 * 60_000, 24 * 60 * 60_000];

    for (const dt of dts) {
        const a = phiAt(ts - dt);
        const b = phiAt(ts + dt);
        if (!isFiniteNumber(a) || !isFiniteNumber(b)) continue;

        const d = toSigned180(norm360(b - a));
        if (!isFiniteNumber(d) || Math.abs(d) < 1e-9) continue;

        const motion: 'ccw' | 'cw' = d > 0 ? 'ccw' : 'cw';

        const speedDegPerMsAbs = Math.abs(d) / (2 * dt);
        const speedDegPerDayAbs = speedDegPerMsAbs * DAY_MS;

        if (speedDegPerDayAbs > 720) continue;

        return { motion, speedDegPerDayAbs };
    }

    return null;
}

function forwardPhase(phiRaw: number, motion: 'ccw' | 'cw'): number {
    const p = norm360(phiRaw);
    return motion === 'ccw' ? p : norm360(360 - p);
}

// ---------------------------
// Directed crossing (scan + bisection) on g(t)=signedDiff(θ_mod, targetDeg)
// ---------------------------

function signedDiffToTarget(thetaMod: number, targetDeg: number): number {
    return toSigned180(norm360(thetaMod - targetDeg)); // [-180..180]
}

function refineCrossingBisection(
    gAt: (t: number) => number,
    tA: number,
    tB: number,
    epsMs: number,
): number | null {
    let lo = Math.min(tA, tB);
    let hi = Math.max(tA, tB);

    let flo = gAt(lo);
    let fhi = gAt(hi);

    if (!isFiniteNumber(flo) || !isFiniteNumber(fhi)) return null;
    if (flo === 0) return lo;
    if (fhi === 0) return hi;
    if (flo * fhi > 0) return null;

    for (let i = 0; i < 140; i++) {
        const mid = 0.5 * (lo + hi);
        const fmid = gAt(mid);
        if (!isFiniteNumber(fmid)) return null;

        if (hi - lo <= epsMs) return mid;

        if (flo * fmid <= 0) {
            hi = mid;
            fhi = fmid;
        } else {
            lo = mid;
            flo = fmid;
        }
    }

    return 0.5 * (lo + hi);
}

type Crossing = { t: number };

function findDirectedCrossingsInWindow(
    thetaModAt: (t: number) => number,
    t0: number,
    t1: number,
    targetDeg: number,
    stepMs: number,
    epsMs: number,
): Crossing[] {
    const out: Crossing[] = [];
    const a = Math.min(t0, t1);
    const b = Math.max(t0, t1);

    const gAt = (t: number) => {
        const th = thetaModAt(t);
        if (!isFiniteNumber(th)) return NaN;
        return signedDiffToTarget(th, targetDeg);
    };

    // PATCH #1: don’t bail out if initial sample is NaN.
    // Also: when coming back from a NaN stretch, reset baseline so we don’t miss crossings.
    let tPrev = a;
    let gPrev = NaN;

    for (let t = a; t <= b + 1; t += stepMs) {
        const tt = Math.min(t, b);
        const g = gAt(tt);

        if (!isFiniteNumber(g)) {
            tPrev = tt;
            gPrev = NaN;
            if (tt >= b) break;
            continue;
        }

        if (!isFiniteNumber(gPrev)) {
            // baseline reset after NaN gap
            tPrev = tt;
            gPrev = g;
            if (tt >= b) break;
            continue;
        }

        // Directed crossing for increasing θ_mod: g < 0 -> g >= 0
        const crosses = (gPrev < 0 && g >= 0) || g === 0 || gPrev === 0;

        if (crosses) {
            const solved = refineCrossingBisection(gAt, tPrev, tt, epsMs);
            if (isFiniteNumber(solved)) out.push({ t: solved as number });
        }

        tPrev = tt;
        gPrev = g;

        if (tt >= b) break;
    }

    out.sort((x, y) => x.t - y.t);

    // de-dupe
    const uniq: Crossing[] = [];
    for (const c of out) {
        if (!uniq.length || Math.abs(uniq[uniq.length - 1].t - c.t) > epsMs * 2) uniq.push(c);
    }

    return uniq;
}

function lastCrossingAtOrBefore(ts: number, crossings: Crossing[]): number | null {
    let best: number | null = null;
    for (const c of crossings) if (c.t <= ts) best = c.t;
    return isFiniteNumber(best) ? best : null;
}

function firstCrossingAfter(ts: number, crossings: Crossing[]): number | null {
    for (const c of crossings) if (c.t > ts) return c.t;
    return null;
}

// PATCH #2 helper: try smaller step if we found zero crossings in a window.
function findCrossingsAdaptiveStep(
    thetaModAt: (t: number) => number,
    t0: number,
    t1: number,
    targetDeg: number,
    stepMs: number,
    epsMs: number,
): { crossings: Crossing[]; stepUsedMs: number; subAttempt: number } {
    let step = stepMs;

    // try: original, /2, /4 (enough to fix “missed” events without exploding cost)
    for (let sub = 0; sub < 3; sub++) {
        const xs = findDirectedCrossingsInWindow(thetaModAt, t0, t1, targetDeg, step, epsMs);
        if (xs.length > 0) return { crossings: xs, stepUsedMs: step, subAttempt: sub };
        step = clamp(step / 2, 5 * 60_000, 30 * DAY_MS);
    }

    return { crossings: [], stepUsedMs: step, subAttempt: 2 };
}

function findNearestCrossingBackward(
    thetaModAt: (t: number) => number,
    ts: number,
    targetDeg: number,
    stepMs: number,
    epsMs: number,
    estPeriodDays: number,
    dbg?: SolveOpts['dbg'],
): number | null {
    let windowMs = clamp(estPeriodDays * DAY_MS * 0.75, 10 * stepMs, 200_000 * DAY_MS);

    for (let attempt = 0; attempt < 22; attempt++) {
        const t0 = ts - windowMs;
        const t1 = ts;

        const { crossings, stepUsedMs, subAttempt } = findCrossingsAdaptiveStep(
            thetaModAt,
            t0,
            t1,
            targetDeg,
            stepMs,
            epsMs,
        );
        const E = lastCrossingAtOrBefore(ts, crossings);

        dbg?.log?.('synod.E.search', {
            attempt,
            subAttempt,
            stepUsedMs,
            t0: fmt(t0),
            t1: fmt(t1),
            windowDays: Number((windowMs / DAY_MS).toFixed(3)),
            crossingsCount: crossings.length,
            picked: E ? fmt(E) : null,
        });

        if (isFiniteNumber(E)) return E as number;

        windowMs = clamp(windowMs * 1.7, 10 * stepMs, 400_000 * DAY_MS);
    }

    return null;
}

function findNearestCrossingForward(
    thetaModAt: (t: number) => number,
    ts: number,
    targetDeg: number,
    stepMs: number,
    epsMs: number,
    estPeriodDays: number,
    dbg?: SolveOpts['dbg'],
): number | null {
    let windowMs = clamp(estPeriodDays * DAY_MS * 0.75, 10 * stepMs, 200_000 * DAY_MS);

    for (let attempt = 0; attempt < 22; attempt++) {
        const t0 = ts;
        const t1 = ts + windowMs;

        const { crossings, stepUsedMs, subAttempt } = findCrossingsAdaptiveStep(
            thetaModAt,
            t0,
            t1,
            targetDeg,
            stepMs,
            epsMs,
        );
        const E2 = firstCrossingAfter(ts, crossings);

        dbg?.log?.('synod.E_next.search', {
            attempt,
            subAttempt,
            stepUsedMs,
            t0: fmt(t0),
            t1: fmt(t1),
            windowDays: Number((windowMs / DAY_MS).toFixed(3)),
            crossingsCount: crossings.length,
            picked: E2 ? fmt(E2) : null,
        });

        if (isFiniteNumber(E2)) return E2 as number;

        windowMs = clamp(windowMs * 1.7, 10 * stepMs, 400_000 * DAY_MS);
    }

    return null;
}

// ---------------------------
// Anchored unwrap θ_unwrap(t) in [90..450) for this cycle
// ---------------------------

function makeThetaUnwrapAt(thetaModAt: (t: number) => number, E_t: number) {
    const EPS_DEG = 1e-4;
    const EPS_MS = 2;

    return (t: number): number => {
        const th = thetaModAt(t);
        if (!isFiniteNumber(th)) return NaN;

        const p = norm360(th);

        if (Math.abs(t - E_t) <= EPS_MS) return 90;

        if (t > E_t) {
            if (p <= 90 + EPS_DEG) return p + 360;
            return p;
        }

        return p;
    };
}

// ---------------------------
// Solve time for target θ_unwrap by bisection in [E..E_next]
// ---------------------------

function solveTimeForThetaUnwrap(
    thetaUnwrapAt: (t: number) => number,
    t0: number,
    t1: number,
    targetU: number,
    opts: SolveOpts,
): number | null {
    const dbg = opts.dbg;
    const maxIters = opts.maxIters ?? 200;
    const epsMs = opts.epsMs ?? 1_000;

    let a = Math.min(t0, t1);
    let b = Math.max(t0, t1);

    let fa = thetaUnwrapAt(a) - targetU;
    let fb = thetaUnwrapAt(b) - targetU;

    if (!isFiniteNumber(fa) || !isFiniteNumber(fb)) return null;
    if (fa === 0) return a;
    if (fb === 0) return b;

    if (fa * fb > 0) {
        dbg?.warn?.('synod.solve.unwrap.not-bracketed', { a: fmt(a), b: fmt(b), fa, fb, targetU });
        return null;
    }

    for (let i = 0; i < maxIters; i++) {
        const mid = 0.5 * (a + b);
        const fm = thetaUnwrapAt(mid) - targetU;
        if (!isFiniteNumber(fm)) return null;

        if (b - a <= epsMs) return mid;

        if (fa * fm <= 0) {
            b = mid;
            fb = fm;
        } else {
            a = mid;
            fa = fm;
        }
    }

    return 0.5 * (a + b);
}

// ---------------------------
// Main solver
// ---------------------------

export function solveSynodWheel(input: WheelInput<'synod'>): CycleSolveResult<SynodMeta> {
    const dbg = input.dbg;

    const fail = (reason: string): CycleSolveResult<SynodMeta> => ({
        ok: false,
        kind: 'cycle',
        ts: input.ts,
        reason,
        spokes: [],
    });

    const ts = input.ts;

    if (!input.looker) return fail('Synod wheel requires looker');
    if (!input.focus) return fail('Synod wheel requires focus');
    if (!input.target) return fail('Synod wheel requires target');

    const looker: ObjId = input.looker;
    const focus: ObjId = input.focus;
    const target: ObjId = Array.isArray(input.target) ? input.target[0] : input.target;

    if (!target) return fail('Synod wheel requires a single target');

    // IMPORTANT: focus must be an engine_body to define the vertex position.
    const focusRec = getObj(focus);
    if (focusRec?.kind === 'reference') {
        return fail(`Synod wheel: focus (vertex) cannot be a reference: ${String(focus)}`);
    }

    const phiRawAt = (t: number) => {
        const r = phaseDeg(looker, focus, target, t);
        return r ? r.phi : NaN;
    };

    const phi0 = phiRawAt(ts);
    if (!isFiniteNumber(phi0)) {
        return fail(
            `Synod wheel: cannot compute phase for looker=${String(looker)} focus=${String(focus)} target=${String(target)}`,
        );
    }

    const dirInfo = detectMotionDir(phiRawAt, ts);
    if (!dirInfo) return fail('Synod wheel: failed to detect phase motion direction near ts');

    const motion: 'ccw' | 'cw' = dirInfo.motion;
    const speedDegPerDayAbs = dirInfo.speedDegPerDayAbs;

    const thetaModAt = (t: number) => {
        const p = phiRawAt(t);
        if (!isFiniteNumber(p)) return NaN;
        return forwardPhase(p, motion);
    };

    // Adaptive scan step: aim ~20° phase per step; clamp.
    const desiredDeg = 20;
    const stepDays = desiredDeg / Math.max(1e-12, speedDegPerDayAbs);
    const stepMs = clamp(stepDays * DAY_MS, 10 * 60_000, 30 * DAY_MS);

    // Bisection epsilon based on step; clamp.
    const epsMs = clamp(stepMs / 128, 50, 5_000);

    const estPeriodDays = 360 / Math.max(1e-12, speedDegPerDayAbs);

    dbg?.log?.('synod.params', {
        looker,
        focus,
        target,
        ts: fmt(ts),
        motion,
        phi0,
        theta0: thetaModAt(ts),
        speedDegPerDayAbs: Number(speedDegPerDayAbs.toFixed(9)),
        stepMs,
        epsMs,
        estPeriodDays: Number(estPeriodDays.toFixed(6)),
    });

    // Find E and E_next separately
    const E_t0 = findNearestCrossingBackward(thetaModAt, ts, 90, stepMs, epsMs, estPeriodDays, dbg);
    if (!isFiniteNumber(E_t0)) return fail('Synod wheel: failed to locate E (θ=90°) at/before ts');

    const epsAfterE = Math.max(2 * epsMs, 60_000); // avoid re-catching same crossing

    const E_next_t0 = findNearestCrossingForward(
        thetaModAt,
        (E_t0 as number) + epsAfterE,
        90,
        stepMs,
        epsMs,
        estPeriodDays,
        dbg,
    );
    if (!isFiniteNumber(E_next_t0) || !((E_t0 as number) < (E_next_t0 as number))) {
        dbg?.warn?.('synod.boundary.not-found', {
            E: isFiniteNumber(E_t0) ? fmt(E_t0 as number) : E_t0,
            E_next: isFiniteNumber(E_next_t0) ? fmt(E_next_t0 as number) : E_next_t0,
            ts: fmt(ts),
            motion,
            estPeriodDays: Number(estPeriodDays.toFixed(6)),
        });
        return fail('Synod wheel: failed to locate E+ (next θ=90°) after E');
    }

    // PATCH #3: normalize window so that E <= ts < E_next.
    let tE = E_t0 as number;
    let tE2 = E_next_t0 as number;

    for (let guard = 0; guard < 8; guard++) {
        if (ts >= tE2) {
            // shift forward: current E becomes previous E_next
            const prevE = tE;
            const prevE2 = tE2;

            const nextE = prevE2;
            const nextE2 = findNearestCrossingForward(thetaModAt, nextE + epsAfterE, 90, stepMs, epsMs, estPeriodDays, dbg);

            dbg?.warn?.('synod.window.shift.forward', {
                guard,
                ts: fmt(ts),
                prev: { E: fmt(prevE), E_next: fmt(prevE2) },
                nextE: fmt(nextE),
                nextE2: isFiniteNumber(nextE2) ? fmt(nextE2 as number) : null,
            });

            if (!isFiniteNumber(nextE2) || !(nextE < (nextE2 as number))) {
                return fail('Synod wheel: failed to normalize window forward (E <= ts < E_next)');
            }

            tE = nextE;
            tE2 = nextE2 as number;
            continue;
        }

        if (ts < tE) {
            // shift backward: find previous E before current E
            const prevE = findNearestCrossingBackward(thetaModAt, tE - epsAfterE, 90, stepMs, epsMs, estPeriodDays, dbg);
            if (!isFiniteNumber(prevE)) return fail('Synod wheel: failed to normalize window backward (prev E not found)');

            const prevE2 = findNearestCrossingForward(thetaModAt, (prevE as number) + epsAfterE, 90, stepMs, epsMs, estPeriodDays, dbg);

            dbg?.warn?.('synod.window.shift.backward', {
                guard,
                ts: fmt(ts),
                cur: { E: fmt(tE), E_next: fmt(tE2) },
                prevE: fmt(prevE as number),
                prevE2: isFiniteNumber(prevE2) ? fmt(prevE2 as number) : null,
            });

            if (!isFiniteNumber(prevE2) || !((prevE as number) < (prevE2 as number))) {
                return fail('Synod wheel: failed to normalize window backward (E_next not found)');
            }

            tE = prevE as number;
            tE2 = prevE2 as number;
            continue;
        }

        // invariant satisfied
        break;
    }

    if (!(tE <= ts && ts < tE2)) {
        dbg?.warn?.('synod.window.invariant.failed', { ts: fmt(ts), E: fmt(tE), E_next: fmt(tE2) });
        return fail('Synod wheel: failed to enforce window invariant (E <= ts < E_next)');
    }

    const thetaUnwrapAt = makeThetaUnwrapAt(thetaModAt, tE);

    dbg?.log?.('synod.boundary', {
        E: fmt(tE),
        E_next: fmt(tE2),
        thetaModE: thetaModAt(tE),
        thetaModE2: thetaModAt(tE2),
        thetaUnwrapE: thetaUnwrapAt(tE),
        thetaUnwrapE2: thetaUnwrapAt(tE2),
        spanDays: Number(((tE2 - tE) / DAY_MS).toFixed(9)),
    });

    const OPT_SOLVE: SolveOpts = {
        maxIters: 220,
        epsMs,
        dbg: { log: dbg?.log, warn: dbg?.warn ?? dbg?.log },
    };

    function wantThetaUnwrapForIndex(i: number): number {
        return 90 + (360 * i) / 16; // 0..16 => 90..450
    }

    // Solve spokes (exact times)
    const tExact: number[] = new Array(17);
    tExact[0] = tE;
    tExact[16] = tE2;

    for (let i = 1; i < 16; i++) {
        const wantU = wantThetaUnwrapForIndex(i);
        const solved = solveTimeForThetaUnwrap(thetaUnwrapAt, tE, tE2, wantU, OPT_SOLVE);

        if (!isFiniteNumber(solved)) {
            dbg?.warn?.('synod.spoke.solve.failed', { i, code: SPOKES_ORDER[i], wantU, fallback: 'lerp' });
        }

        tExact[i] = isFiniteNumber(solved) ? (solved as number) : lerp(tE, tE2, i / 16);
    }

    // monotonic exact times check (warn-only)
    for (let i = 1; i < tExact.length; i++) {
        if (!(tExact[i] >= tExact[i - 1])) {
            dbg?.warn?.('synod: non-monotonic exact times', {
                i,
                prev: { i: i - 1, t: fmt(tExact[i - 1]), code: SPOKES_ORDER[i - 1] ?? String(i - 1) },
                cur: { i, t: fmt(tExact[i]), code: SPOKES_ORDER[i] ?? String(i) },
                E: fmt(tE),
                E_next: fmt(tE2),
                motion,
            });
            break;
        }
    }

    // Angle hit check (exact)
    for (let i = 0; i < tExact.length; i++) {
        const wantU = wantThetaUnwrapForIndex(i);
        const gotU = thetaUnwrapAt(tExact[i]);
        if (!isFiniteNumber(gotU)) {
            dbg?.warn?.('synod.angle.NaN', { i, code: SPOKES_ORDER[i], t: fmt(tExact[i]), wantU });
            continue;
        }
        const err = Math.abs(gotU - wantU);
        if (err > 0.25) {
            dbg?.warn?.('synod.angle.mismatch', { i, code: SPOKES_ORDER[i], t: fmt(tExact[i]), wantU, gotU, err, motion });
        } else if (i === 0 || i === 4 || i === 8 || i === 12 || i === 16) {
            dbg?.log?.('synod.angle.ok', { i, code: SPOKES_ORDER[i], t: fmt(tExact[i]), wantU, gotU, err });
        }
    }

    // Final output times (rounded)
    const tOut = roundToMinuteMonotonic(tExact);

    const cycleDurationTag = formatCycleDurationTag(tE2 - tE);

    function mkSpoke(i: number): CycleSpoke<SynodMeta> {
        const tSolve = tExact[i];
        const tDisplay = tOut[i];

        const r = phaseDeg(looker, focus, target, tSolve);

        const rAu = isFiniteNumber(r?.dT) ? r!.dT : NaN;
        const rKm = isFiniteNumber(rAu) ? rAu * AU_KM : NaN;

        const code = SPOKES_ORDER[i] ?? (i === 16 ? 'E_next' : 'E');
        return {
            ts: tDisplay,
            code,
            index: i,
            tags: synodSpokeTags(code, cycleDurationTag),
            meta: {
                distanceAu: rAu,
                distanceKm: rKm,
                focusDistAu: isFiniteNumber(r?.dL) ? r!.dL : NaN,
                exactTs: tSolve,
            },
        };
    }

    const spokes: CycleSpoke<SynodMeta>[] = [];
    for (let i = 0; i < 17; i++) spokes.push(mkSpoke(i));

    if (spokes[0] && !nearEq(spokes[0].ts, roundToMinuteMs(tE), 60_000, 0)) {
        dbg?.warn?.('synod: spoke[0] minute-round differs from E (expected sometimes)', { spoke0: fmt(spokes[0].ts), E: fmt(tE) });
    }
    if (spokes[16] && !nearEq(spokes[16].ts, roundToMinuteMs(tE2), 60_000, 0)) {
        dbg?.warn?.('synod: spoke[16] minute-round differs from E_next (expected sometimes)', {
            spoke16: fmt(spokes[16].ts),
            E_next: fmt(tE2),
        });
    }

    dbg?.log?.('synod.done', {
        looker,
        focus,
        target,
        ts: fmt(ts),
        motion,
        E: fmt(tE),
        E_next: fmt(tE2),
        durationDays: Number(((tE2 - tE) / DAY_MS).toFixed(9)),
        spokeTs0: fmt(spokes[0]?.ts),
        spokeTs16: fmt(spokes[16]?.ts),
        spokes
    });

    return { ok: true, kind: 'cycle', ts, spokes };
}

// --- synod.ts (add exports) ---

export type SynodInstant = {
    looker: ObjId;
    focus: ObjId;
    target: ObjId;
    ts: number;

    // geometry
    phaseDeg: number;       // φ in [0..360) : 0=S, 180=N
    motion: 'ccw' | 'cw';   // local direction of change of φ near ts
    thetaModDeg: number;    // θ_mod in [0..360) (forwarded for directed-crossing logic)

    // distances (AU)
    distanceAu: number;     // focus -> target
    focusDistAu: number;    // focus -> looker (NaN if looker is reference)
};

// Small helper: instant computation (no cycle solving, no spokes)
export function synodInstantAt(
    looker: ObjId,
    focus: ObjId,
    target: ObjId,
    ts: number,
): SynodInstant | null {
    // focus must be an engine_body vertex
    const focusRec = getObj(focus);
    if (focusRec?.kind === 'reference') return null;

    const phiRawAt = (t: number) => {
        const r = phaseDeg(looker, focus, target, t);
        return r ? r.phi : NaN;
    };

    const r0 = phaseDeg(looker, focus, target, ts);
    if (!r0 || !isFiniteNumber(r0.phi)) return null;

    const dirInfo = detectMotionDir(phiRawAt, ts);
    if (!dirInfo) return null;

    const motion = dirInfo.motion;
    const thetaModDeg = forwardPhase(r0.phi, motion);

    return {
        looker,
        focus,
        target,
        ts,
        phaseDeg: r0.phi,
        motion,
        thetaModDeg,
        distanceAu: r0.dT,
        focusDistAu: r0.dL,
    };
}

/**
 * Convert φ (0=S, 90=E, 180=N, 270=W) to your wheel angle convention
 * (0=E, -90=N, +90=S, ±180=W).
 */
export function synodPhaseToWheelAngleDeg(phaseDeg: number): number {
    // φ=0 => +90 (S), φ=90 => 0 (E), φ=180 => -90 (N), φ=270 => ±180 (W)
    return toSigned180(90 - norm360(phaseDeg));
}
