// src/lib/cycles/draconic.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { isFiniteNumber, safeDateFromTs, utcYearFromTs } from './wheel';

const DAY_MS = 86400_000;

// Draconic month ≈ 27.212220817 days (node -> same node)
const DRACONIC_MONTH_DAYS = 27.212220817;
const DRACONIC_MONTH_MS = DRACONIC_MONTH_DAYS * DAY_MS;

const EXACT_MIN_YEAR = 1600;
const EXACT_MAX_YEAR = 2400;

const DEBUG_DRAC = true;

// initial probe step
const BACKSTEP_DAYS = 15;
const MAX_BACKSTEPS = 28;

// walking chain
const MAX_PREV_STEPS = 64;
const MAX_NEXT_STEPS = 64;

// cycle containing M
const MAX_CYCLE_ADVANCE = 10;

// guard for strict comparisons (ms jitter between calls)
const STRICT_GUARD_MS = 1500;

function fmt(ts: number) {
    if (!Number.isFinite(ts)) return String(ts);
    return new Date(ts).toISOString();
}

function group<T>(title: string, fn: () => T): T {
    if (!DEBUG_DRAC) return fn();
    console.groupCollapsed(`🐉 draconic | ${title}`);
    try {
        return fn();
    } finally {
        console.groupEnd();
    }
}

function log(...args: any[]) {
    if (DEBUG_DRAC) console.log('[draconic]', ...args);
}
function warn(...args: any[]) {
    if (DEBUG_DRAC) console.warn('[draconic]', ...args);
}

type NodeKind = 'Ascending' | 'Descending';

type NodeEvent = {
    // astronomy-engine uses enum 0/1 or string, depending on build.
    // For lunar nodes it is usually: 0 = Ascending, 1 = Descending
    kind: any;
    time: { date: Date };
};

function normalizeKind(k: any): NodeKind | null {
    if (k === 0) return 'Ascending';
    if (k === 1) return 'Descending';

    if (k === 'Ascending' || k === 'Descending') return k;

    if (typeof k === 'string') {
        const kk = k.toLowerCase();
        if (kk === 'ascending') return 'Ascending';
        if (kk === 'descending') return 'Descending';
        // иногда в логах/обёртках встречается "asc" / "desc"
        if (kk === 'asc') return 'Ascending';
        if (kk === 'desc') return 'Descending';
    }
    return null;
}

function kindOf(e: any): NodeKind | null {
    return normalizeKind(e?.kind);
}

function tsOf(e: NodeEvent) {
    return ms(e.time.date.getTime());
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
const APPROX_EPOCH_ASC_NODE_MS = Date.UTC(2000, 0, 1, 0, 0, 0, 0);

function approxAnchors(ts: number): Anchors {
    const period = DRACONIC_MONTH_MS;
    const half = period / 2;
    const quarter = period / 4;

    // anchor around E=Ascending node (approx)
    const k = Math.floor((ts - APPROX_EPOCH_ASC_NODE_MS) / period);
    let E = APPROX_EPOCH_ASC_NODE_MS + k * period;
    while (E > ts) E -= period;
    while (E + period <= ts) E += period;
    E = ms(E);

    const W = ms(E + half);           // descending node
    const N = ms(E + quarter);        // quarter
    const S = ms(E + 3 * quarter);    // 3/4
    const E_next = ms(E + period);

    return { start: E, end: E_next, E, N, W, S, E_next };
}

// ---------- Exact via astronomy-engine ----------

function safeNodeFromSearch(probe: Date, label: string): NodeEvent | null {
    try {
        // astronomy-engine: SearchMoonNode(date) -> NodeEvent-like {time, kind}
        const e = (Astronomy as any).SearchMoonNode(probe) as any as NodeEvent;
        const t = e?.time?.date?.getTime?.();
        if (!(typeof t === 'number' && Number.isFinite(t))) {
            warn(`${label}: bad SearchMoonNode result`, { probe: probe.toISOString(), e });
            return null;
        }
        return e;
    } catch (err) {
        warn(`${label}: SearchMoonNode threw`, err);
        return null;
    }
}

function safeNextNode(cur: NodeEvent): NodeEvent | null {
    try {
        const nxt = (Astronomy as any).NextMoonNode(cur as any) as any as NodeEvent;
        const t = nxt?.time?.date?.getTime?.();
        if (!(typeof t === 'number' && Number.isFinite(t))) return null;
        return nxt;
    } catch {
        return null;
    }
}

// Find ANY node event with time <= ts by backing probe up until Search returns one in the past.
function findAnyNodeAtOrBefore(ts: number): NodeEvent | null {
    const d0 = safeDateFromTs(ts);
    if (!d0) return null;

    let probe = new Date(d0.getTime());

    for (let i = 0; i < MAX_BACKSTEPS; i++) {
        const e = safeNodeFromSearch(probe, 'findAnyNodeAtOrBefore');
        if (!e) {
            probe = new Date(probe.getTime() - BACKSTEP_DAYS * DAY_MS);
            continue;
        }

        const found = tsOf(e);
        log('findAnyNode',
            'probe=', probe.toISOString(),
            'foundKind=', e?.kind, '→', kindOf(e),
            'found=', fmt(found),
            'ts=', fmt(ts)
        );

        if (found <= ts) return e;

        probe = new Date(probe.getTime() - BACKSTEP_DAYS * DAY_MS);
    }

    warn('findAnyNodeAtOrBefore MISS', 'ts=', fmt(ts));
    return null;
}

/**
 * Robust "previous node" step (immediate previous event strictly earlier than cur):
 * 1) find base <= (curTs - guard)
 * 2) walk forward with NextMoonNode until crossing target
 */
function prevImmediateNode(cur: NodeEvent): NodeEvent | null {
    const tCur = tsOf(cur);
    const target = ms(tCur - STRICT_GUARD_MS);

    const base = findAnyNodeAtOrBefore(target);
    if (!base) {
        warn('prevImmediateNode MISS (no base)', { cur: fmt(tCur) });
        return null;
    }

    let last: NodeEvent = base;
    let tLast = tsOf(last);

    if (!(tLast < target)) {
        const base2 = findAnyNodeAtOrBefore(ms(target - BACKSTEP_DAYS * DAY_MS));
        if (!base2) return null;
        last = base2;
        tLast = tsOf(last);
    }

    for (let i = 0; i < MAX_NEXT_STEPS; i++) {
        const nxt = safeNextNode(last);
        if (!nxt) break;

        const tNext = tsOf(nxt);

        if (!(tNext > tLast + 1)) {
            warn('prevImmediateNode: non-increasing Next', { last: fmt(tLast), next: fmt(tNext) });
            break;
        }

        if (tNext >= target) {
            log('prevImmediateNode', 'cur=', fmt(tCur), 'prev=', fmt(tLast), 'prevKind=', last?.kind, '→', kindOf(last));
            return last;
        }

        last = nxt;
        tLast = tNext;
    }

    log('prevImmediateNode (fallback)', 'cur=', fmt(tCur), 'prev=', fmt(tLast), 'prevKind=', last?.kind, '→', kindOf(last));
    return last;
}

// Find previous node of given kind with time <= ts.
function searchPrevNodeOfKind(ts: number, kind: NodeKind): NodeEvent | null {
    const base = findAnyNodeAtOrBefore(ts);
    if (!base) {
        warn('searchPrev MISS (no base)', kind, 'ts=', fmt(ts));
        return null;
    }

    log('searchPrev start', 'want=', kind, 'ts=', fmt(ts), 'base=', fmt(tsOf(base)), 'baseKind=', base?.kind, '→', kindOf(base));

    // Forward scan to get best <= ts
    let best: NodeEvent | null = null;

    let cur: NodeEvent = base;
    for (let i = 0; i < MAX_NEXT_STEPS; i++) {
        const tc = tsOf(cur);
        const ck = kindOf(cur);
        log('searchPrev fwd step', i, 'cur=', fmt(tc), 'curKind=', cur?.kind, '→', ck);

        if (tc <= ts && ck === kind) best = cur;

        const nxt = safeNextNode(cur);
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

    // Backward walk by immediate prev steps
    let back: NodeEvent | null = base;
    for (let i = 0; i < MAX_PREV_STEPS; i++) {
        if (!back) break;

        const tb = tsOf(back);
        const bk = kindOf(back);

        log('searchPrev back step', i, 'cur=', fmt(tb), 'curKind=', back?.kind, '→', bk);

        if (tb <= ts && bk === kind) {
            log('searchPrev HIT (back)', kind, fmt(tb), '<=', fmt(ts));
            return back;
        }

        const prev = prevImmediateNode(back);
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

function nextNodeOfKind(start: NodeEvent, kind: NodeKind, maxSteps = 32): NodeEvent | null {
    try {
        let cur: NodeEvent = start;
        log('nextNode start', 'from=', fmt(tsOf(start)), 'fromKind=', start?.kind, '→', kindOf(start), 'want=', kind);

        for (let i = 0; i < maxSteps; i++) {
            const nxt = safeNextNode(cur);
            if (!nxt) {
                warn('nextNode MISS (no date)', kind, 'after=', fmt(tsOf(start)));
                return null;
            }

            const nk = kindOf(nxt);
            log('nextNode step', i, 'got=', nxt?.kind, '→', nk, 't=', fmt(tsOf(nxt)));

            if (nk === kind) return nxt;
            cur = nxt;
        }
    } catch (e) {
        warn('nextNode ERROR', kind, e);
    }

    warn('nextNode MISS', kind, 'after=', fmt(tsOf(start)));
    return null;
}

function prevAscendingBefore(e: NodeEvent): NodeEvent | null {
    return searchPrevNodeOfKind(tsOf(e) - STRICT_GUARD_MS, 'Ascending');
}

// Build cycle from Ascending node A0 (E):
// D_after = next Descending,
// A_after = next Ascending,
// then define N/S as midpoints between those.
function buildCycleFromAscending(A0: NodeEvent): Anchors | null {
    const tA0 = tsOf(A0);
    log('buildCycleFromAscending', 'A0=', fmt(tA0), 'A0.kind=', A0.kind, '→', kindOf(A0));

    if (kindOf(A0) !== 'Ascending') {
        warn('buildCycleFromAscending: not ascending, got', A0.kind, '→', kindOf(A0));
        return null;
    }

    const D_after = nextNodeOfKind(A0, 'Descending');
    if (!D_after) {
        warn('buildCycle FAIL: no D_after', fmt(tA0));
        return null;
    }

    const A_after = nextNodeOfKind(D_after, 'Ascending');
    if (!A_after) {
        warn('buildCycle FAIL: no A_after', fmt(tsOf(D_after)));
        return null;
    }

    const tDa = tsOf(D_after);
    const tAa = tsOf(A_after);

    const E = tA0;                    // Asc node
    const W = tDa;                    // Desc node
    const N = midpoint(tA0, tDa);     // quarter
    const S = midpoint(tDa, tAa);     // 3/4
    const E_next = tAa;               // next Asc node

    log('cycle points',
        { E: fmt(E), N: fmt(N), W: fmt(W), S: fmt(S), E_next: fmt(E_next) },
        { Asc0: fmt(tA0), Desc: fmt(tDa), Asc1: fmt(tAa) }
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

export function getDraconicAnchors(ts: number): Anchors {
    if (!isFiniteNumber(ts)) return approxAnchors(Date.now());
    const M = ms(ts);

    return group(`M=${fmt(M)}`, () => {
        log('inExactRange =', inExactRange(M));

        if (!inExactRange(M)) {
            log('→ approx (out of range)');
            return approxAnchors(M);
        }

        // Previous Ascending node <= M
        let A = searchPrevNodeOfKind(M + STRICT_GUARD_MS, 'Ascending');
        if (!A) {
            warn('Asc not found → approx');
            return approxAnchors(M);
        }

        log('A0', kindOf(A), fmt(tsOf(A)));

        // Keep advancing/rewinding cycles until M is inside [E, E_next)
        for (let hop = 0; hop < MAX_CYCLE_ADVANCE; hop++) {
            const c = buildCycleFromAscending(A);
            if (!c) {
                warn('cycle build failed → approx');
                return approxAnchors(M);
            }

            const inside = insideCycle(M, c);
            log(`cycle hop=${hop}`, {
                start: fmt(c.start),
                end: fmt(c.end),
                E: fmt(c.E),
                W: fmt(c.W),
                inside,
                M: fmt(M),
            });

            if (inside) {
                log('✔ using cycle', `hop=${hop}`);
                return c;
            }

            if (M < c.start) {
                log('M < start → prev ascending');
                const Aprev = prevAscendingBefore(A);
                if (!Aprev) {
                    warn('Aprev missing → approx');
                    return approxAnchors(M);
                }
                A = Aprev;
                continue;
            }

            log('M ≥ end → next ascending');
            const Anext = nextNodeOfKind(A, 'Ascending');
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

export const angleFromDraconicAnchors = angleFromAnchors;
