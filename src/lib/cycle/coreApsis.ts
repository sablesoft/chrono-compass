// src/lib/cycle/coreApsis.ts
import { ms } from '../format';
import { safeDateFromTs, utcYearFromTs } from '../wheel/wheel';

export const DAY_MS = 86400_000;

export function toAstroTime(Astronomy: any, date: Date) {
    try {
        if (typeof Astronomy.Time === 'function') return new Astronomy.Time(date);
    } catch {}
    try {
        if (typeof Astronomy.MakeTime === 'function') return Astronomy.MakeTime(date);
    } catch {}
    return date as any;
}

export function tsOf(a: { time: { date: Date } }) {
    return ms(a.time.date.getTime());
}

export function inExactRange(ts: number, minYear: number, maxYear: number) {
    const y = utcYearFromTs(ts);
    return y !== null && y >= minYear && y <= maxYear;
}

export function insideCycle(M: number, a: { start: number; end: number }) {
    return M >= a.start && M < a.end;
}

type Logger = {
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    group: <T>(title: string, fn: () => T) => T;
};

export type ApsisOps<TApsis, TKind extends string> = {
    kindOf: (a: any) => TKind | null;
    safeSearch: (probe: Date) => TApsis | null;
    safeNext: (cur: TApsis) => TApsis | null;

    BACKSTEP_DAYS: number;
    MAX_BACKSTEPS: number;
    MAX_PREV_STEPS: number;
    MAX_NEXT_STEPS: number;
    STRICT_GUARD_MS: number;

    // optional debug
    dbg?: Pick<Logger, 'log' | 'warn'>;
};

export function makeApsisWalker<TApsis extends { time: { date: Date } }, TKind extends string>(
    ops: ApsisOps<TApsis, TKind>,
) {
    const {
        kindOf,
        safeSearch,
        safeNext,
        BACKSTEP_DAYS,
        MAX_BACKSTEPS,
        MAX_PREV_STEPS,
        MAX_NEXT_STEPS,
        STRICT_GUARD_MS,
        dbg,
    } = ops;

    function findAnyApsisAtOrBefore(ts: number): TApsis | null {
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

    function prevImmediateApsis(cur: TApsis): TApsis | null {
        const target = ms(tsOf(cur) - STRICT_GUARD_MS);
        const base = findAnyApsisAtOrBefore(target);
        if (!base) return null;

        let last = base;
        let tLast = tsOf(last);

        for (let i = 0; i < MAX_NEXT_STEPS; i++) {
            const nxt = safeNext(last);
            if (!nxt) break;

            const tNext = tsOf(nxt);
            if (!(tNext > tLast + 1)) break;

            if (tNext >= target) return last;

            last = nxt;
            tLast = tNext;
        }
        return last;
    }

    function searchPrevApsisOfKind(ts: number, kind: TKind): TApsis | null {
        let cur = findAnyApsisAtOrBefore(ts);
        for (let i = 0; i < MAX_PREV_STEPS && cur; i++) {
            if (tsOf(cur) <= ts && kindOf(cur) === kind) return cur;
            cur = prevImmediateApsis(cur);
        }
        return null;
    }

    function nextApsisOfKind(start: TApsis, kind: TKind): TApsis | null {
        let cur = start;
        for (let i = 0; i < MAX_NEXT_STEPS; i++) {
            const nxt = safeNext(cur);
            if (!nxt) return null;
            if (kindOf(nxt) === kind) return nxt;
            cur = nxt;
        }
        return null;
    }

    function searchApsisNear(dateMs: number, want: TKind, periodMs: number): TApsis | null {
        // “nearest apsis, but we want specific kind” — nudge search.
        const nudges = [
            0,
            periodMs / 4,
            -periodMs / 4,
            periodMs / 2,
            -periodMs / 2,
            (3 * periodMs) / 4,
            (-3 * periodMs) / 4,
        ];

        for (const dx of nudges) {
            const a = safeSearch(new Date(dateMs + dx));
            if (a && kindOf(a) === want) return a;
        }

        dbg?.warn?.('searchApsisNear MISS', { want, dateMs });
        return null;
    }

    return {
        findAnyApsisAtOrBefore,
        prevImmediateApsis,
        searchPrevApsisOfKind,
        nextApsisOfKind,
        searchApsisNear,
        kindOf,
    };
}