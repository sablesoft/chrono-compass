// src/lib/math/synod.ts
//
// Unified Synod wheel solver (phase-angular, 17 spokes) for any (looker, focus, target)
// where focus may be engine_body OR reference.
//
// NEW v2 (NO cycleDuration):
// - We do NOT assume a stable synodic period.
// - We find the current cycle boundaries dynamically:
//     E      = nearest θ=90° crossing at/before ts
//     E_next = nearest θ=90° crossing after ts   (this is "E+")
// - Then we solve 17 spokes by exact phase angles between E..E_next.
//
// Direction:
// - We detect if raw phase φ increases CCW or decreases CW near ts.
// - We build a "forward phase" θ that ALWAYS increases with time:
//     θ = φ                if motion=CCW
//     θ = 360 - φ          if motion=CW
// - All spoke phase targets are expressed in θ-space: 90..450.
//
// Primary quantity: phase angle around a fixed plane (ecliptic).
//
// reference focus uses catalog meta.direction -> refUnit (fixed inertial unit vector).
// engine bodies use helioVec with a Moon fallback.
//
// Output rounding:
// - spoke.ts is rounded to minutes (ms).
// - spoke.meta phase angles are set to the static target angles of spokes (not measured).

import * as Astronomy from 'astronomy-engine';
import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import type { ObjId, ObjKind, ReferenceMeta } from '../catalog';
import { objects } from '../catalog';
import { SPOKES_ORDER } from '../wheel/types';

import { AU_KM, clamp, DAY_MS, isFiniteNumber, lerp, norm360, toSigned180 } from './helpers';
import { refUnit, lonDegEcliptic, type Vec } from './vector';
import { fmt } from './extrema';

export type SynodMeta = {
    // raw φ in [0..360) (still useful for debugging / tooltip)
    phaseDeg: number;

    // forward θ in [0..360) (θ grows with time)
    phaseForwardDeg: number;

    // unwrapped forward θ in [90..450) for this cycle
    phaseUnwrapDeg: number;

    // motion of raw φ with time near ts
    motion: 'ccw' | 'cw';

    // distances (AU) from looker -> target / focus (focusDistAu = NaN for reference focus)
    distanceAu: number;
    distanceKm: number;
    focusDistAu: number;
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

            if (typeof A.GeoVector === 'function') {
                const vM = A.GeoVector(toEngineBody('Moon'), t, false);
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
// Direction from looker to obj
// ---------------------------

function dirFromLookerToEngine(looker: ObjId, obj: ObjId, ts: number): { u: Vec; distAu: number } | null {
    const pL = helioVec(looker, ts);
    const pB = helioVec(obj, ts);
    if (!pL || !pB) return null;

    const v = sub(pB, pL);
    const d = norm(v);
    const u = normalize(v);
    if (!u) return null;

    return { u, distAu: d };
}

function dirFromLookerToReference(objId: ObjId): { u: Vec; distAu: number } | null {
    const o = getObj(objId);
    const meta = o?.meta as ReferenceMeta | undefined;
    if (!meta) return null;

    const u3 = refUnit(meta);
    if (!u3) return null;

    return { u: { x: u3[0], y: u3[1], z: u3[2] }, distAu: NaN };
}

function dirFromLooker(looker: ObjId, obj: ObjId, ts: number): { u: Vec; distAu: number } | null {
    const rec = getObj(obj);
    if (rec?.kind === 'reference') return dirFromLookerToReference(obj);
    return dirFromLookerToEngine(looker, obj, ts);
}

// ---------------------------
// Phase definition (ecliptic longitudes)
// ---------------------------

function phaseDeg(
    looker: ObjId,
    focus: ObjId,
    target: ObjId,
    ts: number,
): { phi: number; dT: number; dF: number } | null {
    const dF = dirFromLooker(looker, focus, ts);
    const dT = dirFromLooker(looker, target, ts);
    if (!dF || !dT) return null;

    const lonF = lonDegEcliptic(dF.u);
    const lonT = lonDegEcliptic(dT.u);
    const phi = norm360(lonT - lonF);

    return { phi, dT: dT.distAu, dF: dF.distAu };
}

function signedPhaseDiff(phi: number, targetDeg: number): number {
    return toSigned180(norm360(phi - targetDeg));
}

// ---------------------------
// Direction detection + forward phase
// ---------------------------

function detectMotionDir(
    phiAt: (t: number) => number,
    ts: number,
): { motion: 'ccw' | 'cw'; speedDegPerDayAbs: number } | null {
    const dts = [30 * 60_000, 3 * 60 * 60_000, 24 * 60 * 60_000]; // 30m, 3h, 1d

    for (const dt of dts) {
        const a = phiAt(ts - dt);
        const b = phiAt(ts + dt);
        if (!isFiniteNumber(a) || !isFiniteNumber(b)) continue;

        const d = toSigned180(norm360(b - a)); // [-180..180]
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
// Root solve on signed diff (bisection)
// ---------------------------

type Crossing = { t: number };

function refineCrossingBisection(
    gAt: (t: number) => number, // signed diff to target angle in [-180..180]
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

    for (let i = 0; i < 90; i++) {
        const mid = (lo + hi) / 2;
        const fmid = gAt(mid);
        if (!isFiniteNumber(fmid)) return null;

        if (Math.abs(hi - lo) <= epsMs) return mid;

        if (flo * fmid <= 0) {
            hi = mid;
            fhi = fmid;
        } else {
            lo = mid;
            flo = fmid;
        }
    }

    return (lo + hi) / 2;
}

function findCrossingsInWindowDirectional(
    thetaForwardAt: (t: number) => number, // θ in [0..360)
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
        const p = thetaForwardAt(t);
        if (!isFiniteNumber(p)) return NaN;
        return signedPhaseDiff(p, targetDeg); // [-180..180]
    };

    let tPrev = a;
    let gPrev = gAt(tPrev);
    if (!isFiniteNumber(gPrev)) return out;

    for (let t = a + stepMs; t <= b + 1; t += stepMs) {
        const tt = Math.min(t, b);
        const g = gAt(tt);
        if (!isFiniteNumber(g)) {
            tPrev = tt;
            gPrev = g;
            if (tt >= b) break;
            continue;
        }

        // For monotonic-increasing θ, prefer crossing where g goes negative -> non-negative.
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

    const uniq: Crossing[] = [];
    for (const c of out) {
        if (!uniq.length || Math.abs(uniq[uniq.length - 1].t - c.t) > epsMs * 2) uniq.push(c);
    }

    return uniq;
}

function pickEandEnext(ts: number, crossings: Crossing[]): { E: number; E_next: number } | null {
    if (!crossings.length) return null;

    let E: number | null = null;
    let E_next: number | null = null;

    for (const c of crossings) {
        if (c.t <= ts) E = c.t;
        else {
            E_next = c.t;
            break;
        }
    }

    if (!isFiniteNumber(E) || !isFiniteNumber(E_next)) return null;
    if (!(E < E_next)) return null;

    return { E, E_next };
}

// ---------------------------
// Unwrap θ into [90..450) WITH cycle anchor time E_t
// ---------------------------
//
// Key fix vs your current version:
//
// unwrap can't be "value-only" (p < 90 ? p+360 : p) because both E and E_next
// have θ≈90 and you'd get 90/90, killing bracketing.
//
// We anchor at the actual cycle start time E_t:
// - at E_t => 90
// - for t > E_t, if θ is near/below 90, it belongs to the "after wrap" branch => θ+360
//
function makeThetaUnwrapAt(
    thetaForwardAt: (t: number) => number,
    E_t: number,
) {
    const EPS_DEG = 1e-4; // tiny to avoid numerical chatter
    const EPS_MS = 1;     // treat exact E time specially

    return (t: number): number => {
        const th = thetaForwardAt(t);
        if (!isFiniteNumber(th)) return NaN;

        const p = norm360(th);

        // force exact start to be 90 (not 450)
        if (Math.abs(t - E_t) <= EPS_MS) return 90;

        // after start: values near/below 90 belong to the unwrapped branch
        if (t > E_t) {
            if (p <= 90 + EPS_DEG) return p + 360;
            return p;
        }

        // before start: normal branch (shouldn't be used much inside [E..E_next])
        return p;
    };
}

// ---------------------------
// Solve time for target unwrapped θ in [90..450) (bisection)
// ---------------------------

function solveTimeForForwardPhaseUnwrapped(
    thetaUnwrapAt: (t: number) => number,
    t0: number,
    t1: number,
    targetThetaUnwrap: number,
    opts: SolveOpts,
): number | null {
    const dbg = opts.dbg;
    const maxIters = opts.maxIters ?? 120;
    const epsMs = opts.epsMs ?? 200;

    let a = Math.min(t0, t1);
    let b = Math.max(t0, t1);

    let fa = thetaUnwrapAt(a) - targetThetaUnwrap;
    let fb = thetaUnwrapAt(b) - targetThetaUnwrap;

    if (!isFiniteNumber(fa) || !isFiniteNumber(fb)) {
        dbg?.warn?.('synod.v2.solve: NaN endpoints', { a: fmt(a), b: fmt(b), fa, fb, targetThetaUnwrap });
        return null;
    }

    if (fa === 0) return a;
    if (fb === 0) return b;

    if (fa * fb > 0) {
        dbg?.warn?.('synod.v2.solve: not bracketed', { a: fmt(a), b: fmt(b), fa, fb, targetThetaUnwrap });
        return null;
    }

    for (let i = 0; i < maxIters; i++) {
        const mid = (a + b) / 2;
        const fm = thetaUnwrapAt(mid) - targetThetaUnwrap;
        if (!isFiniteNumber(fm)) return null;

        if (Math.abs(b - a) <= epsMs) return mid;

        if (fa * fm <= 0) {
            b = mid;
            fb = fm;
        } else {
            a = mid;
            fa = fm;
        }
    }

    return (a + b) / 2;
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

    // raw φ(t) in [0..360)
    const phiRawAt = (t: number) => {
        const r = phaseDeg(looker, focus, target, t);
        return r ? r.phi : NaN;
    };

    const phi0 = phiRawAt(ts);
    if (!isFiniteNumber(phi0)) {
        return fail(`Synod wheel: cannot compute phase for looker=${String(looker)} focus=${String(focus)} target=${String(target)}`);
    }

    // detect motion of raw φ
    const dirInfo = detectMotionDir(phiRawAt, ts);
    if (!dirInfo) return fail('Synod wheel: failed to detect phase motion direction near ts');

    const motion: 'ccw' | 'cw' = dirInfo.motion;
    const speedDegPerDayAbs = dirInfo.speedDegPerDayAbs;

    // θ(t) forward, always increasing with time (mod 360)
    const thetaForwardAt = (t: number) => {
        const p = phiRawAt(t);
        if (!isFiniteNumber(p)) return NaN;
        return forwardPhase(p, motion);
    };

    // adaptive scan step based on speed: aim ~10° per step
    const desiredDeg = 10;
    const stepDays = desiredDeg / Math.max(1e-6, speedDegPerDayAbs);
    const stepMs = clamp(stepDays * DAY_MS, 5 * 60_000, 5 * DAY_MS);

    // bisection accuracy
    const epsMs = clamp(stepMs / 64, 50, 5_000);

    // initial window from speed-estimated period
    const estPeriodDays = 360 / Math.max(1e-6, speedDegPerDayAbs);
    let halfWindowMs = clamp(estPeriodDays * DAY_MS * 0.8, 2 * stepMs, 4000 * DAY_MS);

    dbg?.log?.('synod.v2.params', {
        looker,
        focus,
        target,
        ts: fmt(ts),
        motion,
        speedDegPerDayAbs: Number(speedDegPerDayAbs.toFixed(6)),
        stepMs,
        epsMs,
        estPeriodDays: Number(estPeriodDays.toFixed(4)),
        halfWindowDays: Number((halfWindowMs / DAY_MS).toFixed(4)),
    });

    // Find E/E_next as θ=90° crossings around ts (expand until found)
    let E_t: number | null = null;
    let E_next_t: number | null = null;

    for (let attempt = 0; attempt < 14; attempt++) {
        const t0 = ts - halfWindowMs;
        const t1 = ts + halfWindowMs;

        const crossings = findCrossingsInWindowDirectional(thetaForwardAt, t0, t1, 90, stepMs, epsMs);
        const picked = pickEandEnext(ts, crossings);

        dbg?.log?.('synod.v2.crossings', {
            attempt,
            t0: fmt(t0),
            t1: fmt(t1),
            halfWindowDays: Number((halfWindowMs / DAY_MS).toFixed(4)),
            crossingsCount: crossings.length,
            picked: picked ? { E: fmt(picked.E), E_next: fmt(picked.E_next) } : null,
        });

        if (picked) {
            E_t = picked.E;
            E_next_t = picked.E_next;
            break;
        }

        halfWindowMs = clamp(halfWindowMs * 1.65, 2 * stepMs, 8000 * DAY_MS);
    }

    if (!isFiniteNumber(E_t) || !isFiniteNumber(E_next_t) || !(E_t! < E_next_t!)) {
        return fail('Synod wheel: failed to locate E/E_next phase crossings around ts');
    }

    // θ_unwrap(t) in [90..450) for this cycle (ANCHOR FIX)
    const thetaUnwrapAt = makeThetaUnwrapAt(thetaForwardAt, E_t!);

    const thetaE = thetaUnwrapAt(E_t!);
    const thetaE2 = thetaUnwrapAt(E_next_t!);

    dbg?.log?.('synod.v2.boundary', {
        E: fmt(E_t!),
        E_next: fmt(E_next_t!),
        thetaE,
        thetaE2,
        spanDays: Number(((E_next_t! - E_t!) / DAY_MS).toFixed(6)),
    });

    // sanity: we expect E ~ 90 and E_next ~ 450 (in unwrapped θ)
    if (!isFiniteNumber(thetaE) || !isFiniteNumber(thetaE2) || thetaE2 <= thetaE) {
        dbg?.warn?.('synod.v2.boundary.suspicious', { thetaE, thetaE2, E: fmt(E_t!), E_next: fmt(E_next_t!), motion });
    } else {
        const okE = Math.abs(thetaE - 90) < 0.05;
        const okE2 = Math.abs(thetaE2 - 450) < 0.05;
        if (!okE || !okE2) dbg?.warn?.('synod.v2.boundary.off', { thetaE, thetaE2, okE, okE2, motion });
    }

    const SOLVE: SolveOpts = {
        maxIters: 140,
        epsMs,
        dbg: { log: dbg?.log, warn: dbg?.warn ?? dbg?.log },
    };

    function wantThetaUnwrapForIndex(i: number): number {
        // 0..16 => 90..450
        return 90 + (360 * i) / 16;
    }

    function mkSpoke(i: number, tSolvedRaw: number): CycleSpoke<SynodMeta> {
        const wantUn = wantThetaUnwrapForIndex(i);
        const wantFwd = norm360(wantUn); // 90..360..0..90

        const tSolved = roundToMinuteMs(tSolvedRaw);

        const r = phaseDeg(looker, focus, target, tSolved);
        const raw = r?.phi ?? NaN;

        const rAu = isFiniteNumber(r?.dT) ? r!.dT : NaN;
        const rKm = isFiniteNumber(rAu) ? rAu * AU_KM : NaN;

        return {
            ts: tSolved,
            code: SPOKES_ORDER[i] ?? (i === 16 ? 'E+' : 'E'),
            index: i,
            meta: {
                // IMPORTANT: spoke angles are static targets (by design)
                phaseDeg: isFiniteNumber(raw) ? raw : NaN,
                phaseForwardDeg: wantFwd,
                phaseUnwrapDeg: wantUn,
                motion,
                distanceAu: rAu,
                distanceKm: rKm,
                focusDistAu: isFiniteNumber(r?.dF) ? r!.dF : NaN,
            },
        };
    }

    const spokes: CycleSpoke<SynodMeta>[] = [];

    // Endpoints exact
    spokes.push(mkSpoke(0, E_t!));

    // Inner spokes: solve by θ_unwrap target
    for (let i = 1; i < 16; i++) {
        const wantTheta = wantThetaUnwrapForIndex(i);

        const solved = solveTimeForForwardPhaseUnwrapped(thetaUnwrapAt, E_t!, E_next_t!, wantTheta, SOLVE);
        const tSolved = isFiniteNumber(solved) ? (solved as number) : lerp(E_t!, E_next_t!, i / 16);

        spokes.push(mkSpoke(i, tSolved));
    }

    spokes.push(mkSpoke(16, E_next_t!));

    // ---------------------------
    // Validation: times order + angles hit
    // ---------------------------

    // 1) Monotonic time check (warn-only). Allow equality because of minute rounding.
    for (let i = 1; i < spokes.length; i++) {
        if (!(spokes[i].ts >= spokes[i - 1].ts)) {
            dbg?.warn?.('synod.v2: non-monotonic spoke times', {
                i,
                prev: { i: i - 1, ts: fmt(spokes[i - 1].ts), code: spokes[i - 1].code },
                cur: { i, ts: fmt(spokes[i].ts), code: spokes[i].code },
                E: fmt(E_t!),
                E_next: fmt(E_next_t!),
                motion,
            });
            break;
        }
    }

    // 2) Angle hit check: compare actual θ_unwrap(t) to wanted.
    for (let i = 0; i < spokes.length; i++) {
        const want = wantThetaUnwrapForIndex(i);
        const got = thetaUnwrapAt(spokes[i].ts);
        if (!isFiniteNumber(got)) {
            dbg?.warn?.('synod.v2.angle: NaN', { i, code: spokes[i].code, ts: fmt(spokes[i].ts), want });
            continue;
        }
        const err = Math.abs(got - want);
        if (err > 0.2) {
            dbg?.warn?.('synod.v2.angle: mismatch', {
                i,
                code: spokes[i].code,
                ts: fmt(spokes[i].ts),
                want,
                got,
                err,
                motion,
            });
        }
    }

    // Endpoint sanity (time)
    if (spokes[0] && !nearEq(spokes[0].ts, roundToMinuteMs(E_t!), 60_000, 0)) {
        dbg?.warn?.('synod.v2: spoke[0] not at E (minute-rounded)', { spoke0: fmt(spokes[0].ts), E: fmt(E_t!) });
    }
    if (spokes[16] && !nearEq(spokes[16].ts, roundToMinuteMs(E_next_t!), 60_000, 0)) {
        dbg?.warn?.('synod.v2: spoke[16] not at E_next (minute-rounded)', { spoke16: fmt(spokes[16].ts), E_next: fmt(E_next_t!) });
    }

    dbg?.log?.('synod.v2.done', {
        looker,
        focus,
        target,
        ts: fmt(ts),
        motion,
        E: fmt(E_t!),
        E_next: fmt(E_next_t!),
        spokeTs0: fmt(spokes[0]?.ts),
        spokeTs16: fmt(spokes[16]?.ts),
    });

    return { ok: true, kind: 'cycle', ts, spokes };
}
