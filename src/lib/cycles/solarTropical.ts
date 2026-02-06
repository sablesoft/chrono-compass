// src/lib/cycles/solarTropical.ts
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { debug } from '../debug';

const dbg = debug('solarTropical', '♉');
const { group, log, warn } = dbg;

const MS_PER_DAY = 86400000;
const JD_UNIX_EPOCH = 2440587.5; // 1970-01-01T00:00:00Z in Julian Day

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

function isFiniteTs(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

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
export function getTropicalAnchors(ts: number, lat: number, lon: number): Anchors {
    ts = ms(ts);

    return group(`ts=${fmt(ts)}`, () => {
        const d = new Date(ts);
        const y = d.getUTCFullYear();

        const evY = yearEventsUtcMs(y);
        const startYear = ts < evY.E ? y - 1 : y;

        const ev0 = yearEventsUtcMs(startYear);

        // sanity checks (помним: это приближения, но порядок обязан быть нормальным)
        if (![ev0.E, ev0.N, ev0.W, ev0.S, ev0.E_next].every(isFiniteTs)) {
            warn('non-finite tropical anchors', {
                year: startYear,
                E: fmt(ev0.E), N: fmt(ev0.N), W: fmt(ev0.W), S: fmt(ev0.S), E_next: fmt(ev0.E_next),
            });
        } else if (!(ev0.E < ev0.N && ev0.N < ev0.W && ev0.W < ev0.S && ev0.S < ev0.E_next)) {
            warn('non-monotonic tropical anchors', {
                year: startYear,
                E: fmt(ev0.E), N: fmt(ev0.N), W: fmt(ev0.W), S: fmt(ev0.S), E_next: fmt(ev0.E_next),
            });
        } else {
            log('tropical anchors', {
                year: startYear,
                E: fmt(ev0.E), N: fmt(ev0.N), W: fmt(ev0.W), S: fmt(ev0.S), E_next: fmt(ev0.E_next),
            });
        }

        return {
            start: ev0.E,
            end: ev0.E_next,

            E: ev0.E,
            N: ev0.N,
            W: ev0.W,
            S: ev0.S,

            E_next: ev0.E_next,
        };
    }) as Anchors;
}

export const angleFromTropicalAnchors = angleFromAnchors;
