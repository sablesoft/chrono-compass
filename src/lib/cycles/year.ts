// src/lib/cycles/year.ts
import type { Anchors } from './spokes';
import { clamp01 } from './spokes';
import { angleFromAnchors } from './angle';
import {ms} from "../format";

const MS_PER_DAY = 86400000;
const JD_UNIX_EPOCH = 2440587.5; // 1970-01-01T00:00:00Z in Julian Day

function jdToUnixMs(jd: number) {
    return ms((jd - JD_UNIX_EPOCH) * MS_PER_DAY);
}

// Meeus-style polynomial approximations for equinoxes/solstices (good enough for UI wheel).
// Returns Julian Day (TT-ish). For our purposes UTC ms is OK (small minutes error tolerated).
function jdeMarchEquinox(y: number) {
    const T = (y - 2000) / 1000;
    return (
        2451623.80984 +
        365242.37404 * T +
        0.05169 * T * T -
        0.00411 * T * T * T -
        0.00057 * T * T * T * T
    );
}

function jdeJuneSolstice(y: number) {
    const T = (y - 2000) / 1000;
    return (
        2451716.56767 +
        365241.62603 * T +
        0.00325 * T * T +
        0.00888 * T * T * T -
        0.00030 * T * T * T * T
    );
}

function jdeSeptemberEquinox(y: number) {
    const T = (y - 2000) / 1000;
    return (
        2451810.21715 +
        365242.01767 * T -
        0.11575 * T * T +
        0.00337 * T * T * T +
        0.00078 * T * T * T * T
    );
}

function jdeDecemberSolstice(y: number) {
    const T = (y - 2000) / 1000;
    return (
        2451900.05952 +
        365242.74049 * T -
        0.06223 * T * T -
        0.00823 * T * T * T +
        0.00032 * T * T * T * T
    );
}

function yearEventsUtcMs(year: number) {
    const E = ms(jdToUnixMs(jdeMarchEquinox(year)));
    const N = ms(jdToUnixMs(jdeJuneSolstice(year)));
    const W = ms(jdToUnixMs(jdeSeptemberEquinox(year)));
    const S = ms(jdToUnixMs(jdeDecemberSolstice(year)));
    const E_next = ms(jdToUnixMs(jdeMarchEquinox(year + 1)));
    return { E, N, W, S, E_next };
}

// Годовой цикл: March equinox -> next March equinox
export function getYearAnchors(
    ts: number,
    lat: number,
    lon: number
): Anchors {
    const d = new Date(ts);
    const y = d.getUTCFullYear();

    // Determine which cycle we're in:
    // If ts is before March equinox of year y, cycle started at March equinox of y-1.
    const evY = yearEventsUtcMs(y);
    const startYear = ts < evY.E ? y - 1 : y;

    const ev0 = yearEventsUtcMs(startYear);

    return {
        start: ev0.E,
        end: ev0.E_next,

        E: ev0.E,
        N: ev0.N,
        W: ev0.W,
        S: ev0.S,

        E_next: ev0.E_next
    };
}

function segProgress(ts: number, a0: number, a1: number) {
    if (a1 === a0) return 0;
    return clamp01((ts - a0) / (a1 - a0));
}

export const angleFromYearAnchors = angleFromAnchors;
