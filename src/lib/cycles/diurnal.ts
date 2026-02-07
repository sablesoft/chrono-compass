// src/lib/cycles/diurnal.ts
import * as Astronomy from 'astronomy-engine';
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { debug } from '../debug';

const dbg = debug('diurnal', '🌎');
const { group, log, warn } = dbg;

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

function isFiniteTs(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function makeObserver(lat: number, lon: number, heightMeters = 0) {
    return new Astronomy.Observer(lat, lon, heightMeters);
}

function sunAltitudeDeg(ts: number, obs: Astronomy.Observer): number {
    const date = new Date(ts);
    const eq = Astronomy.Equator(Astronomy.Body.Sun, date, obs, true, true);
    const hor = Astronomy.Horizon(date, obs, eq.ra, eq.dec, 'normal');
    return hor.altitude;
}

function findExtremumMs(opts: {
    t0: number;
    t1: number;
    obs: Astronomy.Observer;
    kind: 'max' | 'min';
    coarseStepMs?: number;
    refineIters?: number;
}): number | null {
    const { t0, t1, obs, kind, coarseStepMs = 10 * 60_000, refineIters = 50 } = opts;
    if (!(t1 > t0)) return null;

    const alt = (t: number) => sunAltitudeDeg(t, obs);

    let bestT = t0;
    let bestV = alt(t0);
    if (!Number.isFinite(bestV)) return null;

    for (let t = t0; t <= t1; t += coarseStepMs) {
        const v = alt(t);
        if (!Number.isFinite(v)) continue;
        const better = kind === 'max' ? v > bestV : v < bestV;
        if (better) {
            bestV = v;
            bestT = t;
        }
    }

    let lo = Math.max(t0, bestT - coarseStepMs);
    let hi = Math.min(t1, bestT + coarseStepMs);

    for (let i = 0; i < refineIters; i++) {
        const m1 = lo + (hi - lo) / 3;
        const m2 = hi - (hi - lo) / 3;
        const v1 = alt(m1);
        const v2 = alt(m2);
        if (!Number.isFinite(v1) || !Number.isFinite(v2)) break;

        if (kind === 'max') {
            if (v1 < v2) lo = m1;
            else hi = m2;
        } else {
            if (v1 > v2) lo = m1;
            else hi = m2;
        }
    }

    return ms((lo + hi) / 2);
}

/**
 * Ищем пересечение altitude(center) = targetAltDeg.
 * rising=true: ищем переход снизу вверх.
 * rising=false: сверху вниз.
 *
 * Важно: тут есть два режима:
 * - mode="first": вернуть первое пересечение
 * - mode="last": вернуть последнее пересечение
 */
function findAltitudeCrossingMs(opts: {
    t0: number;
    t1: number;
    obs: Astronomy.Observer;
    targetAltDeg: number;
    rising: boolean;
    mode: 'first' | 'last';
    coarseStepMs?: number;
    refineEpsMs?: number;
}): number | null {
    const {
        t0,
        t1,
        obs,
        targetAltDeg,
        rising,
        mode,
        coarseStepMs = 10 * 60_000,
        refineEpsMs = 1000,
    } = opts;

    const f = (t: number) => sunAltitudeDeg(t, obs) - targetAltDeg;

    let prevT = t0;
    let prevF = f(prevT);
    if (!Number.isFinite(prevF)) return null;

    let found: number | null = null;

    for (let t = t0 + coarseStepMs; t <= t1; t += coarseStepMs) {
        const curT = t;
        const curF = f(curT);
        if (!Number.isFinite(curF)) return null;

        const crosses = rising ? (prevF <= 0 && curF >= 0) : (prevF >= 0 && curF <= 0);
        if (crosses) {
            // refine binary on [prevT, curT]
            let lo = prevT;
            let hi = curT;

            while (hi - lo > refineEpsMs) {
                const mid = (lo + hi) / 2;
                const fmid = f(mid);
                if (!Number.isFinite(fmid)) return null;

                if (rising) {
                    if (fmid >= 0) hi = mid;
                    else lo = mid;
                } else {
                    if (fmid <= 0) hi = mid;
                    else lo = mid;
                }
            }

            const hit = ms(hi);
            if (mode === 'first') return hit;
            found = hit; // keep last
        }

        prevT = curT;
        prevF = curF;
    }

    return found;
}

type DayCycle = {
    sunrise: number;
    solarNoon: number;
    sunset: number;
    nextSunrise: number;
    nadir: number;
};

function computeDayCycle(ts: number, lat: number, lon: number): DayCycle | null {
    const obs = makeObserver(lat, lon, 0);

    // “видимый” восход/закат: верхний край касается горизонта.
    // Horizon(...,"normal") учитывает рефракцию, значит целимся в altitude(center) = -R_sun.
    const solarRadiusDeg = 16 / 60; // ~0.266666...
    const targetAltDeg = -solarRadiusDeg;

    // 1) solarNoon = максимум высоты на окне ±12h вокруг ts
    const solarNoon = findExtremumMs({
        t0: ms(ts - 12 * 3600_000),
        t1: ms(ts + 12 * 3600_000),
        obs,
        kind: 'max',
    });
    if (!isFiniteTs(solarNoon)) return null;

    // 2) sunrise = последнее rising-пересечение за 24h до полудня
    const sunrise = findAltitudeCrossingMs({
        t0: ms(solarNoon - 24 * 3600_000),
        t1: solarNoon,
        obs,
        targetAltDeg,
        rising: true,
        mode: 'last',
    });

    // 3) sunset = первое setting-пересечение за 24h после полудня
    const sunset = findAltitudeCrossingMs({
        t0: solarNoon,
        t1: ms(solarNoon + 24 * 3600_000),
        obs,
        targetAltDeg,
        rising: false,
        mode: 'first',
    });

    if (!isFiniteTs(sunrise) || !isFiniteTs(sunset)) {
        // Полярные случаи или near-polar, где пересечения нет
        return null;
    }

    // 4) nextSunrise = первое rising-пересечение после заката (до 36h — с запасом)
    const nextSunrise = findAltitudeCrossingMs({
        t0: sunset,
        t1: ms(sunset + 36 * 3600_000),
        obs,
        targetAltDeg,
        rising: true,
        mode: 'first',
    });
    if (!isFiniteTs(nextSunrise)) return null;

    // 5) nadir = минимум высоты строго между sunset и nextSunrise
    const nadir = findExtremumMs({
        t0: sunset,
        t1: nextSunrise,
        obs,
        kind: 'min',
    });
    if (!isFiniteTs(nadir)) return null;

    return { sunrise: ms(sunrise), solarNoon: ms(solarNoon), sunset: ms(sunset), nextSunrise: ms(nextSunrise), nadir: ms(nadir) };
}

// Суточный цикл: sunrise -> next sunrise
export function getDayAnchors(ts: number, lat: number, lon: number): Anchors {
    ts = ms(ts);

    return group(`ts=${fmt(ts)} lat=${lat.toFixed(5)} lon=${lon.toFixed(5)}`, () => {
        // Пытаемся посчитать цикл вокруг ts.
        // Если ts в предрассветной зоне (после полуночи, но до восхода),
        // solarNoon окажется “сегодня”, а sunrise будет “сегодня (в будущем)”, что не то.
        // Поэтому: если ts < sunrise, пересчитываем вокруг ts-12h (гарантирует попадание в “вчерашний солнечный день”).
        let cycle = computeDayCycle(ts, lat, lon);

        if (cycle && ts < cycle.sunrise) {
            const shifted = ms(ts - 12 * 3600_000);
            const cycle2 = computeDayCycle(shifted, lat, lon);
            if (cycle2) cycle = cycle2;
        }

        if (!cycle) {
            warn('fallback: using ts-based 24h anchors (no rise/set found)');
            const start = ms(ts - (ts % 86400_000));
            const end = ms(start + 86400_000);
            const E = start;
            const N = ms(start + 6 * 3600_000);
            const W = ms(start + 12 * 3600_000);
            const S = ms(start + 18 * 3600_000);
            const E_next = end;
            return { start: E, end: E_next, E, N, W, S, E_next };
        }

        const anchors: Anchors = {
            start: cycle.sunrise,
            end: cycle.nextSunrise,

            E: cycle.sunrise,
            N: cycle.solarNoon,
            W: cycle.sunset,
            S: cycle.nadir,

            E_next: cycle.nextSunrise,
        };

        if (!(anchors.E < anchors.N && anchors.N < anchors.W && anchors.W < anchors.S && anchors.S < anchors.E_next)) {
            warn('non-monotonic day anchors', {
                E: fmt(anchors.E),
                N: fmt(anchors.N),
                W: fmt(anchors.W),
                S: fmt(anchors.S),
                E_next: fmt(anchors.E_next),
            });
        } else {
            log('day anchors', {
                E: fmt(anchors.E),
                N: fmt(anchors.N),
                W: fmt(anchors.W),
                S: fmt(anchors.S),
                E_next: fmt(anchors.E_next),
            });
        }

        return anchors;
    }) as Anchors;
}

export const angleFromDayAnchors = angleFromAnchors;
