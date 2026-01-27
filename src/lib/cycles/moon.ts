import * as Astronomy from 'astronomy-engine';
import type { Anchors } from './spokes';
import { clamp01 } from './spokes';

function segProgress(ts: number, a0: number, a1: number) {
    if (a1 === a0) return 0;
    return clamp01((ts - a0) / (a1 - a0));
}

/**
 * Лунный цикл: FirstQuarter -> next FirstQuarter
 * E=first quarter, N=full, W=third quarter, S=new, E_next=next first quarter
 */
export function getMoonAnchors(ts: number): Anchors {
    // Ищем "текущую" первую четверть (до ts), в пределах 40 дней (хватает с запасом)
    const prevFirst = Astronomy.SearchMoonPhase(90, new Date(ts), -40);
    if (!prevFirst) {
        throw new Error('Moon: cannot find previous first quarter within 40 days');
    }

    // Старт цикла = первая четверть
    let mq = new Astronomy.MoonQuarter(1, prevFirst);

    // Дальше по порядку событий
    const full = Astronomy.NextMoonQuarter(mq);        // quarter 2
    const third = Astronomy.NextMoonQuarter(full);     // quarter 3
    const newm = Astronomy.NextMoonQuarter(third);     // quarter 0
    const nextFirst = Astronomy.NextMoonQuarter(newm); // quarter 1

    const E = mq.time.date.getTime();
    const N = full.time.date.getTime();
    const W = third.time.date.getTime();
    const S = newm.time.date.getTime();
    const E_next = nextFirst.time.date.getTime();

    return {
        start: E,
        end: E_next,

        E,
        N,
        W,
        S,

        E_next
    };
}

export function angleFromMoonAnchors(ts: number, a: Anchors) {
    // E=0, N=-90, W=-180, S=-270, E+=-360
    if (ts < a.N) {
        const p = segProgress(ts, a.E, a.N);
        return -90 * p;
    }
    if (ts < a.W) {
        const p = segProgress(ts, a.N, a.W);
        return -90 - 90 * p;
    }
    if (ts < a.S) {
        const p = segProgress(ts, a.W, a.S);
        return -180 - 90 * p;
    }
    const p = segProgress(ts, a.S, a.E_next);
    return -270 - 90 * p;
}

/**
 * Сдвиг лунного цикла на ±1 цикл.
 * На вход лучше давать "старт цикла" (anchors.E), как ты уже делаешь в day.
 */
export function shiftMoonCycle(cycleStartTs: number, dir: -1 | 1) {
    // Чтобы не поймать тот же самый event, чуть сдвигаем старт
    const start = new Date(cycleStartTs + (dir > 0 ? 60_000 : -60_000));

    const limitDays = dir > 0 ? 40 : -40;
    const t = Astronomy.SearchMoonPhase(90, start, limitDays);
    if (!t) {
        throw new Error('Moon: cannot shift first quarter within 40 days');
    }
    return t.date.getTime();
}
