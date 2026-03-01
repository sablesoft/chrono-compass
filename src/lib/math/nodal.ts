import * as Astronomy from 'astronomy-engine';

import type { WheelInput, CycleSolveResult, CycleSpoke } from '../board/runtime';
import { objects } from '../catalog';
import type { ObjId, ObjKind, ReferenceMeta } from '../catalog';
import { SPOKES_ORDER } from '../wheel/types';
import type { SpokeKey } from '../wheel/types';
import { AU_KM, clamp, DAY_MS, isFiniteNumber, lerp } from './helpers';
import { refUnit } from './vector';

type Vec = { x: number; y: number; z: number };
type ObjRec = { id: ObjId; kind: ObjKind; meta?: any } | null;

export type NodalMeta = {
    nodalLatitudeDeg: number;
    targetDistanceAu: number;
    targetDistanceKm: number;
};

function getObj(id: ObjId): ObjRec {
    return ((objects as any)?.[id] as ObjRec) ?? null;
}

function isReferenceId(id: ObjId): boolean {
    const rec = getObj(id);
    return rec?.kind === 'reference';
}

function isEngineBodyId(id: ObjId): boolean {
    const rec = getObj(id);
    return rec?.kind === 'engine_body';
}

function toEngineBody(id: ObjId): any {
    return (Astronomy as any).Body?.[id as any] ?? (Astronomy as any).Body?.Sun;
}

function helioVec(id: ObjId, ts: number): Vec | null {
    if (!isEngineBodyId(id)) return null;

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

    // Moon fallback: heliocentric Moon = heliocentric Earth + geocentric Moon.
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

function mul(a: Vec, k: number): Vec {
    return { x: a.x * k, y: a.y * k, z: a.z * k };
}

function dot(a: Vec, b: Vec): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross(a: Vec, b: Vec): Vec {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
    };
}

function norm(a: Vec): number {
    return Math.hypot(a.x, a.y, a.z);
}

function normalize(a: Vec): Vec | null {
    const m = norm(a);
    if (!(m > 0) || !isFiniteNumber(m)) return null;
    return { x: a.x / m, y: a.y / m, z: a.z / m };
}

function relativeVec(origin: ObjId, obj: ObjId, ts: number): Vec | null {
    const pO = helioVec(origin, ts);
    const pB = helioVec(obj, ts);
    if (!pO || !pB) return null;
    return sub(pB, pO);
}

function referencePlaneNormalFromPair(looker: ObjId, focus: ObjId, ts: number): Vec | null {
    const r = relativeVec(looker, focus, ts);
    if (!r) return null;

    const tryDt = [6 * 60 * 60_000, 24 * 60 * 60_000, 3 * DAY_MS];
    for (const dt of tryDt) {
        const r0 = relativeVec(looker, focus, ts - dt);
        const r1 = relativeVec(looker, focus, ts + dt);
        if (!r0 || !r1) continue;
        const v = mul(sub(r1, r0), 1 / (2 * dt));
        const n = cross(r, v);
        const u = normalize(n);
        if (u) return u;
    }

    return null;
}

type NodalModel =
    | { mode: 'pair'; looker: ObjId; focus: ObjId; originBody: ObjId }
    | { mode: 'axis'; axisRef: ObjId; anchorBody: ObjId; originBody: ObjId };

function resolveNodalModel(looker: ObjId, focus: ObjId): NodalModel | null {
    const lookerIsRef = isReferenceId(looker);
    const focusIsRef = isReferenceId(focus);

    // axis mode: exactly one reference + one engine body
    if (lookerIsRef || focusIsRef) {
        if (lookerIsRef && focusIsRef) return null;

        const axisRef = lookerIsRef ? looker : focus;
        const anchorBody = lookerIsRef ? focus : looker;
        if (!isEngineBodyId(anchorBody)) return null;

        return {
            mode: 'axis',
            axisRef,
            anchorBody,
            originBody: anchorBody,
        };
    }

    // pair mode: both engine bodies
    if (!isEngineBodyId(looker) || !isEngineBodyId(focus)) return null;
    return { mode: 'pair', looker, focus, originBody: focus };
}

function axisNormalFromReference(axisRef: ObjId): Vec | null {
    const rec = getObj(axisRef);
    if (!rec || rec.kind !== 'reference') return null;
    const meta = rec.meta as ReferenceMeta | undefined;
    if (!meta) return null;
    const u3 = refUnit(meta);
    if (!u3) return null;
    return { x: u3[0], y: u3[1], z: u3[2] };
}

function referencePlaneNormal(model: NodalModel, ts: number): Vec | null {
    if (model.mode === 'axis') return axisNormalFromReference(model.axisRef);
    return referencePlaneNormalFromPair(model.looker, model.focus, ts);
}

function nodalLatitudeDeg(model: NodalModel, target: ObjId, ts: number): number {
    const nRef = referencePlaneNormal(model, ts);
    if (!nRef) return NaN;

    const rT = relativeVec(model.originBody, target, ts);
    if (!rT) return NaN;
    const uT = normalize(rT);
    if (!uT) return NaN;

    const s = clamp(dot(uT, nRef), -1, 1);
    return (Math.asin(s) * 180) / Math.PI;
}

function targetDistanceAu(originBody: ObjId, target: ObjId, ts: number): number {
    const r = relativeVec(originBody, target, ts);
    return r ? norm(r) : NaN;
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

function nodalSpokeTags(code: SpokeKey, index: number, cycleDurationMs: number): string[] {
    const codeTag = code === 'E_next' ? null : `${code}-nodal`;
    const durTag = code === 'E' ? formatCycleDurationTag(cycleDurationMs) : '';
    const isSideNorth = index >= 1 && index <= 7;
    const isSideSouth = index >= 9 && index <= 15;

    return uniqueTags([
        codeTag,
        code === 'E' ? 'cycle start' : null,
        code === 'E' ? 'cycle end' : null,
        (code === 'E' || code === 'E_next') ? 'E-nodal' : null,
        (code === 'E' || code === 'E_next') ? 'ascending node' : null,
        code === 'W' ? 'W-nodal' : null,
        code === 'W' ? 'descending node' : null,
        code === 'N' ? 'max latitude' : null,
        code === 'N' ? 'north apex' : null,
        code === 'S' ? 'min latitude' : null,
        code === 'S' ? 'south nadir' : null,
        isSideNorth ? 'north side' : null,
        isSideSouth ? 'south side' : null,
        durTag || null,
    ]);
}

function refineCrossingBisection(fAt: (t: number) => number, t0: number, t1: number, epsMs = 1000): number | null {
    let lo = Math.min(t0, t1);
    let hi = Math.max(t0, t1);
    let flo = fAt(lo);
    let fhi = fAt(hi);

    if (!isFiniteNumber(flo) || !isFiniteNumber(fhi)) return null;
    if (flo === 0) return lo;
    if (fhi === 0) return hi;
    if (flo * fhi > 0) return null;

    for (let i = 0; i < 120; i++) {
        const mid = (lo + hi) * 0.5;
        const fmid = fAt(mid);
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

    return (lo + hi) * 0.5;
}

function findLatitudeCrossingMs(opts: {
    t0: number;
    t1: number;
    latAt: (t: number) => number;
    rising: boolean;
    mode: 'first' | 'last';
    coarseStepMs?: number;
    refineEpsMs?: number;
}): number | null {
    const {
        t0,
        t1,
        latAt,
        rising,
        mode,
        coarseStepMs = 30 * 60_000,
        refineEpsMs = 1000,
    } = opts;

    if (!(t1 > t0)) return null;

    const fAt = (t: number) => latAt(t);

    let prevT = t0;
    let prevF = fAt(prevT);
    if (!isFiniteNumber(prevF)) return null;

    let found: number | null = null;

    for (let t = t0 + coarseStepMs; t <= t1 + 1; t += coarseStepMs) {
        const curT = Math.min(t, t1);
        const curF = fAt(curT);
        if (!isFiniteNumber(curF)) {
            prevT = curT;
            prevF = curF;
            if (curT >= t1) break;
            continue;
        }

        const crosses = rising
            ? ((prevF < 0 && curF >= 0) || (prevF <= 0 && curF > 0))
            : ((prevF > 0 && curF <= 0) || (prevF >= 0 && curF < 0));

        if (crosses) {
            const solved = refineCrossingBisection(fAt, prevT, curT, refineEpsMs);
            if (isFiniteNumber(solved)) {
                if (mode === 'first') return solved;
                found = solved;
            }
        }

        prevT = curT;
        prevF = curF;
        if (curT >= t1) break;
    }

    return found;
}

function findNearestAscendingBefore(latAt: (t: number) => number, ts: number): number | null {
    const base = 45 * DAY_MS;
    const maxWindow = 800 * 365 * DAY_MS;
    for (let window = base; window <= maxWindow; window *= 2) {
        const step = clamp(window / 2400, 15 * 60_000, 3 * DAY_MS);
        const hit = findLatitudeCrossingMs({
            t0: ts - window,
            t1: ts,
            latAt,
            rising: true,
            mode: 'last',
            coarseStepMs: step,
            refineEpsMs: 1000,
        });
        if (isFiniteNumber(hit)) return hit;
    }
    return null;
}

function findNearestAscendingAfter(latAt: (t: number) => number, ts: number): number | null {
    const base = 45 * DAY_MS;
    const maxWindow = 800 * 365 * DAY_MS;
    const start = ts + 1000;
    for (let window = base; window <= maxWindow; window *= 2) {
        const step = clamp(window / 2400, 15 * 60_000, 3 * DAY_MS);
        const hit = findLatitudeCrossingMs({
            t0: start,
            t1: start + window,
            latAt,
            rising: true,
            mode: 'first',
            coarseStepMs: step,
            refineEpsMs: 1000,
        });
        if (isFiniteNumber(hit) && hit > ts) return hit;
    }
    return null;
}

function findExtremumMs(opts: {
    t0: number;
    t1: number;
    valueAt: (t: number) => number;
    kind: 'max' | 'min';
    coarseStepMs?: number;
    refineIters?: number;
}): number | null {
    const { t0, t1, valueAt, kind, coarseStepMs = 30 * 60_000, refineIters = 48 } = opts;
    if (!(t1 > t0)) return null;

    let bestT = t0;
    let bestV = valueAt(t0);
    if (!isFiniteNumber(bestV)) return null;

    for (let t = t0; t <= t1 + 1; t += coarseStepMs) {
        const tt = Math.min(t, t1);
        const v = valueAt(tt);
        if (!isFiniteNumber(v)) continue;
        const better = kind === 'max' ? v > bestV : v < bestV;
        if (better) {
            bestV = v;
            bestT = tt;
        }
        if (tt >= t1) break;
    }

    let lo = Math.max(t0, bestT - coarseStepMs);
    let hi = Math.min(t1, bestT + coarseStepMs);
    for (let i = 0; i < refineIters; i++) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        const v1 = valueAt(m1);
        const v2 = valueAt(m2);
        if (!isFiniteNumber(v1) || !isFiniteNumber(v2)) break;
        if (kind === 'max') {
            if (v1 < v2) lo = m1;
            else hi = m2;
        } else {
            if (v1 > v2) lo = m1;
            else hi = m2;
        }
    }
    return (lo + hi) * 0.5;
}

function findTimeAtLatitudeMs(opts: {
    t0: number;
    t1: number;
    latAt: (t: number) => number;
    targetLatDeg: number;
    refineEpsMs?: number;
}): number | null {
    const { t0, t1, latAt, targetLatDeg, refineEpsMs = 1000 } = opts;
    if (!(t1 > t0)) return null;

    const f = (t: number) => latAt(t) - targetLatDeg;
    return refineCrossingBisection(f, t0, t1, refineEpsMs);
}

function buildSpoke(index: number, ts: number, model: NodalModel, target: ObjId, cycleDurationMs: number): CycleSpoke<NodalMeta> {
    const code = SPOKES_ORDER[index] ?? (index === 16 ? 'E_next' : 'E');
    const lat = nodalLatitudeDeg(model, target, ts);
    const distAu = targetDistanceAu(model.originBody, target, ts);
    return {
        ts,
        code,
        index,
        tags: nodalSpokeTags(code, index, cycleDurationMs),
        meta: {
            nodalLatitudeDeg: lat,
            targetDistanceAu: distAu,
            targetDistanceKm: isFiniteNumber(distAu) ? distAu * AU_KM : NaN,
        },
    };
}

export function solveNodalWheel(input: WheelInput<'nodal'>): CycleSolveResult<NodalMeta> {
    const dbg = input.dbg;
    const fail = (reason: string): CycleSolveResult<NodalMeta> => ({
        ok: false,
        kind: 'cycle',
        ts: input.ts,
        reason,
        spokes: [],
    });

    const ts = input.ts;
    const looker = input.looker as ObjId | undefined;
    const focus = input.focus as ObjId | undefined;
    const targetRaw = input.target;
    const target = (Array.isArray(targetRaw) ? targetRaw[0] : targetRaw) as ObjId | undefined;

    if (!looker) return fail('Nodal wheel requires looker');
    if (!focus) return fail('Nodal wheel requires focus');
    if (!target) return fail('Nodal wheel requires target');

    if (!isEngineBodyId(target)) return fail(`Nodal wheel: target must be engine body (got ${String(target)})`);

    const model = resolveNodalModel(looker, focus);
    if (!model) {
        return fail(
            'Nodal wheel: invalid looker/focus pair. Use either two engine bodies, or one reference axis + one engine body.'
        );
    }

    if (!isEngineBodyId(model.originBody)) {
        return fail('Nodal wheel: origin body is not an engine body');
    }
    if (target === model.originBody) {
        return fail(`Nodal wheel: target must differ from origin body (got ${String(target)})`);
    }

    const latAt = (t: number) => nodalLatitudeDeg(model, target, t);

    const e = findNearestAscendingBefore(latAt, ts);
    if (!isFiniteNumber(e)) return fail('Nodal wheel: failed to locate previous ascending node (E)');

    const eNext = findNearestAscendingAfter(latAt, ts);
    if (!isFiniteNumber(eNext) || !(eNext > e)) {
        return fail('Nodal wheel: failed to locate next ascending node (E_next)');
    }

    const span = eNext - e;
    const stepInside = clamp(span / 1200, 15 * 60_000, 6 * 60 * 60_000);
    const w = findLatitudeCrossingMs({
        t0: e,
        t1: eNext,
        latAt,
        rising: false,
        mode: 'first',
        coarseStepMs: stepInside,
        refineEpsMs: 1000,
    });
    if (!isFiniteNumber(w) || !(w > e && w < eNext)) {
        return fail('Nodal wheel: failed to locate descending node (W) inside cycle');
    }

    const n = findExtremumMs({
        t0: e,
        t1: w,
        valueAt: latAt,
        kind: 'max',
        coarseStepMs: stepInside,
    });
    const s = findExtremumMs({
        t0: w,
        t1: eNext,
        valueAt: latAt,
        kind: 'min',
        coarseStepMs: stepInside,
    });
    if (!isFiniteNumber(n) || !isFiniteNumber(s)) {
        return fail('Nodal wheel: failed to locate N/S extrema');
    }
    if (!(e < n && n < w && w < s && s < eNext)) {
        return fail('Nodal wheel: invalid anchor ordering (E < N < W < S < E_next)');
    }

    const anchorsT = [e, n, w, s, eNext];
    const anchorsV = anchorsT.map((t) => latAt(t));
    if (anchorsV.some((v) => !isFiniteNumber(v))) {
        return fail('Nodal wheel: invalid nodal latitude values at anchors');
    }

    const cycleDurationMs = eNext - e;
    const spokes: CycleSpoke<NodalMeta>[] = [];

    for (let i = 0; i <= 16; i++) {
        let t = NaN;
        if (i === 0) t = e;
        else if (i === 4) t = n;
        else if (i === 8) t = w;
        else if (i === 12) t = s;
        else if (i === 16) t = eNext;
        else {
            const q = Math.floor(i / 4); // 0..3
            const r = i % 4;             // 1..3
            const u = r / 4;
            const t0 = anchorsT[q];
            const t1 = anchorsT[q + 1];
            const v0 = anchorsV[q];
            const v1 = anchorsV[q + 1];
            const vTarget = lerp(v0, v1, u);
            const solved = findTimeAtLatitudeMs({
                t0,
                t1,
                latAt,
                targetLatDeg: vTarget,
                refineEpsMs: 1000,
            });
            t = isFiniteNumber(solved) ? solved : lerp(t0, t1, u);
        }

        if (!isFiniteNumber(t)) return fail(`Nodal wheel: failed to solve spoke[${i}]`);
        spokes.push(buildSpoke(i, t, model, target, cycleDurationMs));
    }

    for (let i = 1; i < spokes.length; i++) {
        if (!(spokes[i].ts > spokes[i - 1].ts)) {
            return fail(`Nodal wheel: non-monotonic spokes at i=${i}`);
        }
    }

    dbg?.log?.('nodal.done', {
        ts: new Date(ts).toISOString(),
        mode: model.mode,
        looker,
        focus,
        originBody: model.originBody,
        target,
        E: new Date(e).toISOString(),
        N: new Date(n).toISOString(),
        W: new Date(w).toISOString(),
        S: new Date(s).toISOString(),
        E_next: new Date(eNext).toISOString(),
    });

    return {
        ok: true,
        kind: 'cycle',
        ts,
        spokes,
    };
}
