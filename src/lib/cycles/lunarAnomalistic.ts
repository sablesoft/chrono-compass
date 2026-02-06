// src/lib/cycles/lunarAnomalistic.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { isFiniteNumber, safeDateFromTs, utcYearFromTs } from './wheel';
import { debug } from '../debug';

const dbg = debug('lunarAnomalistic', '🌙️');
const { group, log, warn } = dbg;

const DAY_MS = 86400_000;

// Anomalistic month ≈ 27.55454988 days (perigee -> perigee)
const ANOMALISTIC_MONTH_DAYS = 27.55454988;
const ANOMALISTIC_MONTH_MS = ANOMALISTIC_MONTH_DAYS * DAY_MS;

const EXACT_MIN_YEAR = 1600;
const EXACT_MAX_YEAR = 2400;

// how far we jump backwards when trying to locate a previous apsis (initial probe)
const BACKSTEP_DAYS = 15;
const MAX_BACKSTEPS = 28;

// for walking apse chain
const MAX_PREV_STEPS = 64;
const MAX_NEXT_STEPS = 64;

// how many cycles we can advance when searching a cycle containing M
const MAX_CYCLE_ADVANCE = 10;

// Safety guard for "strictly earlier" comparisons.
// astronomy-engine results can differ by milliseconds between calls.
const STRICT_GUARD_MS = 1500;

function fmt(ts: number) {
    if (!Number.isFinite(ts)) return String(ts);
    return new Date(ts).toISOString();
}

type ApsisKind = 'Perigee' | 'Apogee';

type Apsis = {
    kind: any; // astronomy-engine may return enum 0/1
    time: { date: Date };
    dist_km?: number;
};

function normalizeKind(k: any): ApsisKind | null {
    if (k === 0) return 'Perigee';
    if (k === 1) return 'Apogee';

    if (k === 'Perigee' || k === 'Apogee') return k;

    if (typeof k === 'string') {
        const kk = k.toLowerCase();
        if (kk === 'perigee') return 'Perigee';
        if (kk === 'apogee') return 'Apogee';
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
    if (y === null) return false;
    return y >= EXACT_MIN_YEAR && y <= EXACT_MAX_YEAR;
}

function midpoint(a: number, b: number) {
    return ms((a + b) / 2);
}

function insideCycle(M: number, a: Anchors) {
    // half-open interval prevents boundary glitches when M == end
    return M >= a.start && M < a.end;
}

// ---------- Approx fallback ----------
const APPROX_EPOCH_APOGEE_MS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);

function approxAnchors(ts: number): Anchors {
    const period = ANOMALISTIC_MONTH_MS;
    const half = period / 2;
    const quarter = period / 4;

    const k = Math.floor((ts - APPROX_EPOCH_APOGEE_MS) / period);
    let N = APPROX_EPOCH_APOGEE_MS + k * period;
    while (N > ts) N -= period;
    while (N + period <= ts) N += period;
    N = ms(N);

    const P_before = ms(N - half);
    const S = ms(N + half);
    const E = ms(N - quarter);
    const W = ms(N + quarter);
    const E_next = ms(N + 3 * quarter);

    return { start: E, end: E_next, E, N, W, S, E_next };
}

// ---------- Exact via astronomy-engine ----------

function safeApsisFromSearch(probe: Date, label: string): Apsis | null {
    const a = Astronomy.SearchLunarApsis(probe) as any as Apsis;
    const t = a?.time?.date?.getTime?.();
    if (!(typeof t === 'number' && Number.isFinite(t))) {
        warn(`${label}: bad SearchLunarApsis result`, { probe: probe.toISOString(), a });
        return null;
    }
    return a;
}

function safeNextApsis(cur: Apsis): Apsis | null {
    try {
        const nxt = Astronomy.NextLunarApsis(cur as any) as any as Apsis;
        const t = nxt?.time?.date?.getTime?.();
        if (!(typeof t === 'number' && Number.isFinite(t))) return null;
        return nxt;
    } catch {
        return null;
    }
}

// Find ANY apsis with time <= ts by backing the probe up until Search returns one in the past.
function findAnyApsisAtOrBefore(ts: number): Apsis | null {
    const d0 = safeDateFromTs(ts);
    if (!d0) return null;

    let probe = new Date(d0.getTime());

    for (let i = 0; i < MAX_BACKSTEPS; i++) {
        const a = safeApsisFromSearch(probe, 'findAnyApsisAtOrBefore');
        if (!a) {
            probe = new Date(probe.getTime() - BACKSTEP_DAYS * DAY_MS);
            continue;
        }

        const found = tsOf(a);
        log('findAnyApsis',
            'probe=', probe.toISOString(),
            'foundKind=', a?.kind, '→', kindOf(a),
            'found=', fmt(found),
            'ts=', fmt(ts)
        );

        if (found <= ts) return a;

        // got a future apsis -> move probe back
        probe = new Date(probe.getTime() - BACKSTEP_DAYS * DAY_MS);
    }

    warn('findAnyApsisAtOrBefore MISS', 'ts=', fmt(ts));
    return null;
}

/**
 * Robust "previous apsis" step:
 * We want the immediate previous apsis strictly earlier than cur (no skipping Perigee/Apogee).
 *
 * Strategy:
 * 1) Find some base apsis <= (curTs - guard) using findAnyApsisAtOrBefore.
 * 2) Walk forward with NextLunarApsis until the next would cross curTs.
 *    Return the last one that is still strictly < curTs.
 *
 * This avoids the bug where SearchLunarApsis(probe) keeps returning Apogees and
 * you "miss" the Perigees, eventually jumping months back.
 */
function prevImmediateApsis(cur: Apsis): Apsis | null {
    const tCur = tsOf(cur);
    const target = ms(tCur - STRICT_GUARD_MS);

    const base = findAnyApsisAtOrBefore(target);
    if (!base) {
        warn('prevImmediateApsis MISS (no base)', { cur: fmt(tCur) });
        return null;
    }

    let last: Apsis = base;
    let tLast = tsOf(last);

    // If base is not actually before cur (can happen on boundaries), step further back once.
    if (!(tLast < target)) {
        const base2 = findAnyApsisAtOrBefore(ms(target - BACKSTEP_DAYS * DAY_MS));
        if (!base2) return null;
        last = base2;
        tLast = tsOf(last);
    }

    for (let i = 0; i < MAX_NEXT_STEPS; i++) {
        const nxt = safeNextApsis(last);
        if (!nxt) break;

        const tNext = tsOf(nxt);

        // Safety: prevent non-increasing loops
        if (!(tNext > tLast + 1)) {
            warn('prevImmediateApsis: non-increasing Next', { last: fmt(tLast), next: fmt(tNext) });
            break;
        }

        if (tNext >= target) {
            // last is the immediate previous < target
            log('prevImmediateApsis', 'cur=', fmt(tCur), 'prev=', fmt(tLast), 'prevKind=', last?.kind, '→', kindOf(last));
            return last;
        }

        last = nxt;
        tLast = tNext;
    }

    // If we never crossed target, last is still < target but might be far behind.
    // Still return it — callers have additional sanity checks.
    log('prevImmediateApsis (fallback)', 'cur=', fmt(tCur), 'prev=', fmt(tLast), 'prevKind=', last?.kind, '→', kindOf(last));
    return last;
}

// Find previous apsis of given kind with time <= ts.
function searchPrevApsisOfKind(ts: number, kind: ApsisKind): Apsis | null {
    const base = findAnyApsisAtOrBefore(ts);
    if (!base) {
        warn('searchPrev MISS (no base)', kind, 'ts=', fmt(ts));
        return null;
    }

    log('searchPrev start', 'want=', kind, 'ts=', fmt(ts), 'base=', fmt(tsOf(base)), 'baseKind=', base?.kind, '→', kindOf(base));

    // Forward scan from base to get the best <= ts (cheap and accurate).
    let best: Apsis | null = null;

    let cur: Apsis = base;
    for (let i = 0; i < MAX_NEXT_STEPS; i++) {
        const tc = tsOf(cur);
        const ck = kindOf(cur);
        log('searchPrev fwd step', i, 'cur=', fmt(tc), 'curKind=', cur?.kind, '→', ck);

        if (tc <= ts && ck === kind) best = cur;

        const nxt = safeNextApsis(cur);
        if (!nxt) break;

        const tn = tsOf(nxt);
        log('searchPrev fwd next', i, 'next=', fmt(tn), 'nextKind=', nxt?.kind, '→', kindOf(nxt));

        if (tn > ts) break;
        cur = nxt;
    }

    if (best) {
        log('searchPrev HIT (fwd)', kind, fmt(tsOf(best)), '<=', fmt(ts));
        return best;
    }

    // If forward scan didn't find it, walk backward by immediate previous apsis steps.
    let back: Apsis | null = base;
    for (let i = 0; i < MAX_PREV_STEPS; i++) {
        if (!back) break;

        const tb = tsOf(back);
        const bk = kindOf(back);

        log('searchPrev back step', i, 'cur=', fmt(tb), 'curKind=', back?.kind, '→', bk);

        if (tb <= ts && bk === kind) {
            log('searchPrev HIT (back)', kind, fmt(tb), '<=', fmt(ts));
            return back;
        }

        const prev = prevImmediateApsis(back);
        if (!prev) break;

        const tp = tsOf(prev);
        if (!(tp < tb - 1)) {
            warn('searchPrev back FAIL: non-decreasing prev', { prev: fmt(tp), cur: fmt(tb) });
            break;
        }

        back = prev;
    }

    warn('searchPrev MISS', kind, 'ts=', fmt(ts), 'base=', fmt(tsOf(base)));
    return null;
}

function nextApsisOfKind(start: Apsis, kind: ApsisKind, maxSteps = 32): Apsis | null {
    try {
        let cur: Apsis = start;
        log('nextApsis start', 'from=', fmt(tsOf(start)), 'fromKind=', start?.kind, '→', kindOf(start), 'want=', kind);

        for (let i = 0; i < maxSteps; i++) {
            const nxt = safeNextApsis(cur);
            if (!nxt) {
                warn('nextApsis MISS (no date)', kind, 'after=', fmt(tsOf(start)));
                return null;
            }

            const nk = kindOf(nxt);
            log('nextApsis step', i, 'got=', nxt?.kind, '→', nk, 't=', fmt(tsOf(nxt)));

            if (nk === kind) return nxt;
            cur = nxt;
        }
    } catch (e) {
        warn('nextApsis ERROR', kind, e);
    }

    warn('nextApsis MISS', kind, 'after=', fmt(tsOf(start)));
    return null;
}

function prevApogeeBefore(ap: Apsis): Apsis | null {
    return searchPrevApsisOfKind(tsOf(ap) - STRICT_GUARD_MS, 'Apogee');
}

// Build cycle around apogee A0:
// P_before (prev Perigee), P_after (next Perigee), A_after (next Apogee),
// then E/W/E_next are midpoints between neighboring apsides.
function buildCycleFromApogee(A0: Apsis): Anchors | null {
    const tA0 = tsOf(A0);
    log('buildCycleFromApogee', 'A0=', fmt(tA0), 'A0.kind=', A0.kind, '→', kindOf(A0));

    const P_before = searchPrevApsisOfKind(tA0 - STRICT_GUARD_MS, 'Perigee');
    if (!P_before) {
        warn('buildCycle FAIL: no P_before', fmt(tA0));
        return null;
    }

    const P_after = nextApsisOfKind(A0, 'Perigee');
    if (!P_after) {
        warn('buildCycle FAIL: no P_after', fmt(tA0));
        return null;
    }

    const A_after = nextApsisOfKind(P_after, 'Apogee');
    if (!A_after) {
        warn('buildCycle FAIL: no A_after', fmt(tsOf(P_after)));
        return null;
    }

    const tPb = tsOf(P_before);
    const tPa = tsOf(P_after);
    const tAa = tsOf(A_after);

    const E = midpoint(tPb, tA0);
    const N = tA0;
    const W = midpoint(tA0, tPa);
    const S = tPa;
    const E_next = midpoint(tPa, tAa);

    log('cycle points',
        { E: fmt(E), N: fmt(N), W: fmt(W), S: fmt(S), E_next: fmt(E_next) },
        { Pb: fmt(tPb), A0: fmt(tA0), Pa: fmt(tPa), Aa: fmt(tAa) }
    );

    if (!(E < N && N < W && W < S && S < E_next)) {
        warn('buildCycle FAIL: non-monotonic', { E: fmt(E), N: fmt(N), W: fmt(W), S: fmt(S), E_next: fmt(E_next) });
        return null;
    }

    const spanDays = (E_next - E) / DAY_MS;
    if (!(spanDays > 10 && spanDays < 60)) {
        warn('buildCycle FAIL: suspicious span', spanDays.toFixed(3), 'days', { start: fmt(E), end: fmt(E_next) });
        return null;
    }

    return { start: E, end: E_next, E, N, W, S, E_next };
}

export function getLunarAnomalisticAnchors(ts: number): Anchors {
    if (!isFiniteNumber(ts)) return approxAnchors(Date.now());
    const M = ms(ts);

    return group(`M=${fmt(M)}`, () => {
        log('inExactRange =', inExactRange(M));

        if (!inExactRange(M)) {
            log('→ approx (out of range)');
            return approxAnchors(M);
        }

        // previous apogee <= M (tiny +guard for boundary)
        let A = searchPrevApsisOfKind(M + STRICT_GUARD_MS, 'Apogee');
        if (!A) {
            warn('A0 not found → approx');
            return approxAnchors(M);
        }

        log('A0', kindOf(A), fmt(tsOf(A)));

        // Keep advancing/rewinding cycles until M is inside [E, E_next)
        for (let hop = 0; hop < MAX_CYCLE_ADVANCE; hop++) {
            const c = buildCycleFromApogee(A);
            if (!c) {
                warn('cycle build failed → approx');
                return approxAnchors(M);
            }

            const inside = insideCycle(M, c);
            log(`cycle hop=${hop}`, {
                start: fmt(c.start),
                end: fmt(c.end),
                N: fmt(c.N),
                S: fmt(c.S),
                inside,
                M: fmt(M),
            });

            if (inside) {
                log('✔ using cycle', `hop=${hop}`);
                return c;
            }

            if (M < c.start) {
                log('M < start → prev apogee');
                const Aprev = prevApogeeBefore(A);
                if (!Aprev) {
                    warn('Aprev missing → approx');
                    return approxAnchors(M);
                }
                A = Aprev;
                continue;
            }

            log('M ≥ end → next apogee');
            const Anext = nextApsisOfKind(A, 'Apogee');
            if (!Anext) {
                warn('Anext missing → approx');
                return approxAnchors(M);
            }
            A = Anext;
        }

        warn('MAX_CYCLE_ADVANCE reached → approx');
        return approxAnchors(M);
    }) as Anchors;
}

export const angleFromLunarAnomalisticAnchors = angleFromAnchors;