// src/lib/cycles/moon.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import {ms} from "../format";
import {isFiniteNumber, safeDateFromTs, utcYearFromTs} from './wheel';

const DAY_MS = 86400_000;
const SYNODIC_MONTH_DAYS = 29.530588853;
const SYNODIC_MONTH_MS = SYNODIC_MONTH_DAYS * DAY_MS;
const QUARTER_MS = SYNODIC_MONTH_MS / 4;

// Опора для аппроксимации
const APPROX_EPOCH_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0, 0);

// “точный” диапазон для astronomy-engine (можешь сузить/расширить)
const EXACT_MIN_YEAR = 1600;
const EXACT_MAX_YEAR = 2400;

function approxMoonAnchors(ts: number): Anchors {
    // цикл: FirstQuarter -> next FirstQuarter
    const k = Math.floor((ts - APPROX_EPOCH_NEW_MOON_MS) / SYNODIC_MONTH_MS);
    const newMoon0 = APPROX_EPOCH_NEW_MOON_MS + k * SYNODIC_MONTH_MS;

    let first = newMoon0 + QUARTER_MS;
    while (first > ts) first -= SYNODIC_MONTH_MS;
    while (first + SYNODIC_MONTH_MS <= ts) first += SYNODIC_MONTH_MS;

    const E = ms(first);
    const N = ms(E + QUARTER_MS);
    const W = ms(E + 2 * QUARTER_MS);
    const S = ms(E + 3 * QUARTER_MS);
    const E_next = ms(E + 4 * QUARTER_MS);

    let anchors = { start: E, end: E_next, E, N, W, S, E_next };

    console.log('approxMoonAnchors', ts, anchors);

    return anchors;
}

function inExactRange(ts: number) {
    const y = utcYearFromTs(ts);
    if (y === null) return false;
    return y >= EXACT_MIN_YEAR && y <= EXACT_MAX_YEAR;
}

function searchFirstQuarterAtOrBefore(ts: number) {
    const d = safeDateFromTs(ts);
    if (!d) return null;

    // расширяем окно
    for (const w of [40, 80, 160, 320]) {
        try {
            const t = Astronomy.SearchMoonPhase(90, d, -w);
            if (t) return t;
        } catch {
            return null;
        }
    }
    return null;
}

export function getMoonAnchors(ts: number): Anchors {
    if (!isFiniteNumber(ts)) return approxMoonAnchors(Date.now());
    ts = ms(ts);

    if (!inExactRange(ts)) return approxMoonAnchors(ts);

    // КЛЮЧ: если стоим ровно на границе (E события),
    // относимся к новому циклу => опорное событие берём строго ДО ts
    const prevFirst = searchFirstQuarterAtOrBefore(ts + 1);
    if (!prevFirst) return approxMoonAnchors(ts);

    try {
        const mq = new Astronomy.MoonQuarter(1, prevFirst);
        const full = Astronomy.NextMoonQuarter(mq);
        const third = Astronomy.NextMoonQuarter(full);
        const newm = Astronomy.NextMoonQuarter(third);
        const nextFirst = Astronomy.NextMoonQuarter(newm);

        const E = ms(mq.time.date.getTime());
        const N = ms(full.time.date.getTime());
        const W = ms(third.time.date.getTime());
        const S = ms(newm.time.date.getTime());
        const E_next = ms(nextFirst.time.date.getTime());

        if (![E, N, W, S, E_next].every(isFiniteNumber)) return approxMoonAnchors(ts);
        return { start: E, end: E_next, E, N, W, S, E_next };
    } catch {
        return approxMoonAnchors(ts);
    }
}

export const angleFromMoonAnchors = angleFromAnchors;
