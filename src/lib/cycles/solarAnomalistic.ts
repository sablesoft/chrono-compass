// src/lib/cycles/solarAnomalistic.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { isFiniteNumber, safeDateFromTs, utcYearFromTs } from './wheel';
import {debug} from "../debug";
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
const MAX_PREV_STEPS = 24;
const MAX_NEXT_STEPS = 24;
const MAX_CYCLE_ADVANCE = 6;

// Guard against millisecond jitter
const STRICT_GUARD_MS = 1500;

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

function tsOf(a: Apsis) {
    return ms(a.time.date.getTime());
}

function inExactRange(ts: number) {
    const y = utcYearFromTs(ts);
    return y !== null && y >= EXACT_MIN_YEAR && y <= EXACT_MAX_YEAR;
}

function midpoint(a: number, b: number) {
    return ms((a + b) / 2);
}

function insideCycle(M: number, a: Anchors) {
    return M >= a.start && M < a.end;
}

// ---------- Approx fallback (GEOMETRY MATCHES EXACT!) ----------

// Reference aphelion ~ July 4, 2000
const APPROX_EPOCH_APHELION_MS = Date.UTC(2000, 6, 4, 0, 0, 0, 0);

function approxAnchors(ts: number): Anchors {
    const period = ANOMALISTIC_YEAR_MS;
    const half = period / 2;

    // nearest aphelion <= ts
    const k = Math.floor((ts - APPROX_EPOCH_APHELION_MS) / period);
    let A0 = APPROX_EPOCH_APHELION_MS + k * period;
    while (A0 > ts) A0 -= period;
    while (A0 + period <= ts) A0 += period;
    A0 = ms(A0);

    const P_before = ms(A0 - half);
    const P_after  = ms(A0 + half);
    const A_after  = ms(A0 + period);

    const E      = midpoint(P_before, A0);
    const N      = A0;
    const W      = midpoint(A0, P_after);
    const S      = P_after;
    const E_next = midpoint(P_after, A_after);

    return { start: E, end: E_next, E, N, W, S, E_next };
}

// ---------- Exact via astronomy-engine ----------

function safeSearch(probe: Date): Apsis | null {
    try {
        const a = (Astronomy as any).SearchPlanetApsis(Astronomy.Body.Earth, probe) as Apsis;
        const t = a?.time?.date?.getTime?.();
        return (typeof t === 'number' && Number.isFinite(t)) ? a : null;
    } catch {
        return null;
    }
}

function safeNext(cur: Apsis): Apsis | null {
    try {
        const a = (Astronomy as any).NextPlanetApsis(cur as any) as Apsis;
        const t = a?.time?.date?.getTime?.();
        return (typeof t === 'number' && Number.isFinite(t)) ? a : null;
    } catch {
        return null;
    }
}

function findAnyApsisAtOrBefore(ts: number): Apsis | null {
    const d0 = safeDateFromTs(ts);
    if (!d0) return null;

    let probe = new Date(d0.getTime());

    for (let i = 0; i < MAX_BACKSTEPS; i++) {
        const a = safeSearch(probe);
        if (!a) {
            probe = new Date(probe.getTime() - BACKSTEP_DAYS * DAY_MS);
            continue;
        }
        if (tsOf(a) <= ts) return a;
        probe = new Date(probe.getTime() - BACKSTEP_DAYS * DAY_MS);
    }
    return null;
}

function prevImmediateApsis(cur: Apsis): Apsis | null {
    const target = ms(tsOf(cur) - STRICT_GUARD_MS);
    const base = findAnyApsisAtOrBefore(target);
    if (!base) return null;

    let last = base;
    for (let i = 0; i < MAX_NEXT_STEPS; i++) {
        const nxt = safeNext(last);
        if (!nxt) break;
        if (tsOf(nxt) >= target) return last;
        last = nxt;
    }
    return last;
}

function searchPrevApsisOfKind(ts: number, kind: ApsisKind): Apsis | null {
    let cur = findAnyApsisAtOrBefore(ts);
    for (let i = 0; i < MAX_PREV_STEPS && cur; i++) {
        if (tsOf(cur) <= ts && kindOf(cur) === kind) return cur;
        cur = prevImmediateApsis(cur);
    }
    return null;
}

function nextApsisOfKind(start: Apsis, kind: ApsisKind): Apsis | null {
    let cur = start;
    for (let i = 0; i < MAX_NEXT_STEPS; i++) {
        const nxt = safeNext(cur);
        if (!nxt) return null;
        if (kindOf(nxt) === kind) return nxt;
        cur = nxt;
    }
    return null;
}

function prevAphelionBefore(a: Apsis) {
    return searchPrevApsisOfKind(tsOf(a) - STRICT_GUARD_MS, 'Aphelion');
}

// ---------- Build cycle ----------

function buildCycleFromAphelion(A0: Apsis): Anchors | null {
    const tA0 = tsOf(A0);

    const P_before = searchPrevApsisOfKind(tA0 - STRICT_GUARD_MS, 'Perihelion');
    const P_after  = nextApsisOfKind(A0, 'Perihelion');
    const A_after  = P_after ? nextApsisOfKind(P_after, 'Aphelion') : null;

    if (!P_before || !P_after || !A_after) return null;

    const E      = midpoint(tsOf(P_before), tA0);
    const N      = tA0;
    const W      = midpoint(tA0, tsOf(P_after));
    const S      = tsOf(P_after);
    const E_next = midpoint(tsOf(P_after), tsOf(A_after));

    if (!(E < N && N < W && W < S && S < E_next)) return null;

    return { start: E, end: E_next, E, N, W, S, E_next };
}

// ---------- Public API ----------

export function getSolarAnomalisticAnchors(ts: number): Anchors {
    if (!isFiniteNumber(ts)) return approxAnchors(Date.now());
    const M = ms(ts);

    return group(`M=${fmt(M)}`, () => {
        if (!inExactRange(M)) {
            warn('out of exact range → approx', fmt(M));
            return approxAnchors(M);
        }

        let A = searchPrevApsisOfKind(M + STRICT_GUARD_MS, 'Aphelion');
        if (!A) {
            warn('Aphelion not found → approx', fmt(M));
            return approxAnchors(M);
        }

        for (let i = 0; i < MAX_CYCLE_ADVANCE; i++) {
            const c = buildCycleFromAphelion(A);
            if (!c) {
                warn('cycle build failed → approx', {
                    A: fmt(tsOf(A)),
                    M: fmt(M),
                });
                return approxAnchors(M);
            }
            if (insideCycle(M, c)) {
                log('cycle hit', {
                    M: fmt(M),
                    start: fmt(c.start),
                    end: fmt(c.end),
                    N: fmt(c.N),
                    S: fmt(c.S),
                });
                return c;
            }
            if (M < c.start) {
                log('rewind to previous cycle');
                A = prevAphelionBefore(A)!;
            } else {
                log('advance to next cycle');
                A = nextApsisOfKind(A, 'Aphelion')!;
            }
        }
        return approxAnchors(M);
    }) as Anchors;
}

export const angleFromSolarAnomalisticAnchors = angleFromAnchors;