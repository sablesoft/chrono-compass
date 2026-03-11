// src/lib/math/helpers.ts

export const DAY_MS = 86_400_000;

export const AU_KM = 149_597_870.7;
export const AU_PER_LY = 63_241.077;

export function isFiniteNumber(n: unknown): n is number {
    return typeof n === 'number' && Number.isFinite(n);
}

export function lerp(a: number, b: number, u01: number) {
    return a + (b - a) * u01;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

export function norm360(deg: number): number {
    const x = deg % 360;
    return x < 0 ? x + 360 : x;
}

export function toSigned180(deg0_360: number): number {
    let a = norm360(deg0_360);
    if (a > 180) a -= 360;
    return a;
}

export function deg2rad(d: number): number {
    return (d * Math.PI) / 180;
}

export type Ext = {
    t: number;
    v: number;
};


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

export function formatCycleDurationTag(ms: number): string {
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

export type CycleWindowPoint = {
    ts: number;
    tags?: string[];
};

export function currentHouseAtTs<T extends { ts: number; code: string }>(
    spokes: T[] | undefined,
    ts: number
): string | undefined {
    if (!spokes?.length || !Number.isFinite(ts)) return undefined;

    const sorted = spokes
        .filter((row) => Number.isFinite(row.ts))
        .slice()
        .sort((a, b) => a.ts - b.ts);
    if (!sorted.length) return undefined;

    if (ts <= sorted[0].ts) return sorted[0].code;
    for (let i = 0; i < sorted.length - 1; i++) {
        const cur = sorted[i];
        const next = sorted[i + 1];
        if (ts < next.ts) return cur.code;
        if (ts === next.ts) return next.code;
    }
    return sorted[sorted.length - 1].code;
}

export function trackInMainCycleWindow<T extends CycleWindowPoint>(
    track: T[] | undefined,
    mainCycle: string,
    nowTs: number
): T[] | undefined {
    if (!track?.length) return track;
    const startTag = `E-${mainCycle}`;
    const endTag = `E_next-${mainCycle}`;

    const sorted = track
        .filter((p) => Number.isFinite(p.ts))
        .slice()
        .sort((a, b) => a.ts - b.ts);
    if (!sorted.length) return [];

    const starts = sorted.filter((p) => Array.isArray(p.tags) && p.tags.includes(startTag));
    const ends = sorted.filter((p) => Array.isArray(p.tags) && p.tags.includes(endTag));
    if (!starts.length || !ends.length) return sorted;

    let best: { start: number; end: number } | null = null;
    let bestInside = Number.POSITIVE_INFINITY;
    let bestDist = Number.POSITIVE_INFINITY;
    let bestSpan = Number.POSITIVE_INFINITY;

    for (const start of starts) {
        const end = ends.find((candidate) => candidate.ts > start.ts);
        if (!end) continue;
        const insidePenalty = (start.ts <= nowTs && nowTs < end.ts) ? 0 : 1;
        const distPenalty = insidePenalty === 0
            ? Math.abs(nowTs - start.ts)
            : Math.min(Math.abs(nowTs - start.ts), Math.abs(nowTs - end.ts));
        const span = end.ts - start.ts;
        if (
            insidePenalty < bestInside ||
            (insidePenalty === bestInside && distPenalty < bestDist) ||
            (insidePenalty === bestInside && distPenalty === bestDist && span < bestSpan)
        ) {
            best = { start: start.ts, end: end.ts };
            bestInside = insidePenalty;
            bestDist = distPenalty;
            bestSpan = span;
        }
    }

    if (!best) return sorted;
    return sorted.filter((p) => p.ts >= best.start && p.ts <= best.end);
}
