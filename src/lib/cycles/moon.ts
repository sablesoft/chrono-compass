// src/lib/cycles/moon.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';

const DAY_MS = 24 * 60 * 60 * 1000;
const SAFE_WINDOW_DAYS = 80; // запас, чтобы точно захватить нужные события
const EPS_MS = 60_000;       // 1 минута — чтобы не попасть в тот же event

function searchFirstQuarterAfter(ts: number, limitDays = 40) {
    const t = Astronomy.SearchMoonPhase(90, new Date(ts + EPS_MS), limitDays);
    if (!t) throw new Error('Moon: cannot find next first quarter');
    return t;
}

// Ищем "первую четверть на или до ts" так:
// 1) стартуем сильно раньше
// 2) ищем первую четверть ПОСЛЕ старта
// 3) шагаем к следующим первым четвертям пока не перепрыгнем ts
function searchFirstQuarterAtOrBefore(ts: number) {
    const start = ts - SAFE_WINDOW_DAYS * DAY_MS;
    let cur = Astronomy.SearchMoonPhase(90, new Date(start), SAFE_WINDOW_DAYS);
    if (!cur) throw new Error('Moon: cannot find first quarter in window');

    while (true) {
        const next = Astronomy.SearchMoonPhase(90, new Date(cur.date.getTime() + EPS_MS), 40);
        if (!next) break;

        const nextTs = next.date.getTime();
        if (nextTs <= ts) {
            cur = next;
            continue;
        }
        break;
    }

    return cur;
}

/**
 * Лунный цикл: FirstQuarter -> next FirstQuarter
 * E=first quarter, N=full, W=third quarter, S=new, E_next=next first quarter
 */
export function getMoonAnchors(ts: number): Anchors {
    // Гарантированно берём первую четверть <= ts
    const prevFirst = searchFirstQuarterAtOrBefore(ts);

    // Дальше по порядку кварталов
    const q1 = new Astronomy.MoonQuarter(1, prevFirst); // first quarter
    const full = Astronomy.NextMoonQuarter(q1);         // quarter 2
    const third = Astronomy.NextMoonQuarter(full);      // quarter 3
    const newm = Astronomy.NextMoonQuarter(third);      // quarter 0
    const nextFirst = Astronomy.NextMoonQuarter(newm);  // quarter 1

    const E = q1.time.date.getTime();
    const N = full.time.date.getTime();
    const W = third.time.date.getTime();
    const S = newm.time.date.getTime();
    const E_next = nextFirst.time.date.getTime();

    return {
        start: E,
        end: E_next,
        E, N, W, S,
        E_next
    };
}

export const angleFromMoonAnchors = angleFromAnchors;
