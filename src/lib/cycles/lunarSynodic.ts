// src/lib/cycles/lunarSynodic.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from '../wheel/spokes';
import { angleFromAnchors } from './angle';
import {ms} from "../format";
import { safeDateFromTs, utcYearFromTs} from '../wheel/wheel';
import { isFiniteNumber } from '../math/helpers';

import { debug } from '../debug';

const dbg = debug('lunarSynodic', '🌓');
const { group, log, warn } = dbg;

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

    log('approxMoonAnchors', {
        ts: new Date(ts).toISOString(),
        E: new Date(E).toISOString(),
        N: new Date(N).toISOString(),
        W: new Date(W).toISOString(),
        S: new Date(S).toISOString(),
        E_next: new Date(E_next).toISOString(),
    });

    return anchors;
}

function inExactRange(ts: number) {
    const y = utcYearFromTs(ts);
    if (y === null) return false;
    return y >= EXACT_MIN_YEAR && y <= EXACT_MAX_YEAR;
}

function searchFirstQuarterAtOrBefore(ts: number) {
    const d = safeDateFromTs(ts);
    if (!d) {
        warn('searchFirstQuarter: bad date', ts);
        return null;
    }

    for (const w of [40, 80, 160, 320]) {
        try {
            const t = Astronomy.SearchMoonPhase(90, d, -w);
            if (t) {
                log('found FirstQuarter', {
                    windowDays: w,
                    time: t.date?.toISOString?.()
                });
                return t;
            }
        } catch (err) {
            warn('SearchMoonPhase threw', { window: w, err });
            return null;
        }
    }

    warn('FirstQuarter not found in any window', ts);
    return null;
}

export function getSynodicAnchors(ts: number): Anchors {
    if (!isFiniteNumber(ts)) return approxMoonAnchors(Date.now());
    ts = ms(ts);

    return group(`ts=${new Date(ts).toISOString()}`, () => {
        if (!inExactRange(ts)) {
            warn('out of exact range → approx');
            return approxMoonAnchors(ts);
        }

        // КЛЮЧ: если стоим ровно на границе (E события),
        // относимся к новому циклу
        const prevFirst = searchFirstQuarterAtOrBefore(ts + 1);
        if (!prevFirst) {
            warn('prevFirst not found → approx');
            return approxMoonAnchors(ts);
        }

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

            if (![E, N, W, S, E_next].every(isFiniteNumber)) {
                warn('non-finite anchor → approx', { E, N, W, S, E_next });
                return approxMoonAnchors(ts);
            }

            if (!(E <= ts && ts < E_next)) {
                warn('ts not inside [E,E_next)', {
                    ts: new Date(ts).toISOString(),
                    E: new Date(E).toISOString(),
                    E_next: new Date(E_next).toISOString(),
                });
            } else {
                log('cycle hit', {
                    E: new Date(E).toISOString(),
                    N: new Date(N).toISOString(),
                    W: new Date(W).toISOString(),
                    S: new Date(S).toISOString(),
                    E_next: new Date(E_next).toISOString(),
                });
            }

            return { start: E, end: E_next, E, N, W, S, E_next };
        } catch (err) {
            warn('exception → approx', err);
            return approxMoonAnchors(ts);
        }
    }) as Anchors;
}

export const angleFromSynodicAnchors = angleFromAnchors;
