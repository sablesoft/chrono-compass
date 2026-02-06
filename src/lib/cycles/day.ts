// src/lib/cycles/day.ts
import SunCalc from 'suncalc';
import type { Anchors } from './spokes';
import { angleFromAnchors } from './angle';
import { ms } from '../format';
import { debug } from '../debug';

const dbg = debug('day', '🌎');
const { group, log, warn } = dbg;

type AnchorTimes = {
    sunrise: number;
    solarNoon: number;
    sunset: number;
    nadir: number;
};

function fmt(ts: number) {
    return Number.isFinite(ts) ? new Date(ts).toISOString() : String(ts);
}

function isFiniteTs(x: unknown): x is number {
    return typeof x === 'number' && Number.isFinite(x);
}

function getAnchorTimes(day: Date, lat: number, lon: number): AnchorTimes | null {
    const t = SunCalc.getTimes(day, lat, lon);

    const sunrise = t.sunrise?.getTime?.();
    const solarNoon = t.solarNoon?.getTime?.();
    const sunset = t.sunset?.getTime?.();
    const nadir = t.nadir?.getTime?.();

    const ok =
        isFiniteTs(sunrise) &&
        isFiniteTs(solarNoon) &&
        isFiniteTs(sunset) &&
        isFiniteTs(nadir);

    if (!ok) {
        warn('SunCalc.getTimes returned non-finite anchors (polar day/night?)', {
            day: day.toISOString(),
            lat,
            lon,
            sunrise: fmt(Number(sunrise)),
            solarNoon: fmt(Number(solarNoon)),
            sunset: fmt(Number(sunset)),
            nadir: fmt(Number(nadir)),
        });
        return null;
    }

    return {
        sunrise: ms(sunrise),
        solarNoon: ms(solarNoon),
        sunset: ms(sunset),
        nadir: ms(nadir),
    };
}

// Суточный цикл: sunrise -> next sunrise
export function getDayAnchors(ts: number, lat: number, lon: number): Anchors {
    ts = ms(ts);

    return group(`ts=${fmt(ts)} lat=${lat.toFixed(5)} lon=${lon.toFixed(5)}`, () => {
        const d = new Date(ts);

        const aToday = getAnchorTimes(d, lat, lon);
        if (!aToday) {
            // На полярных широтах некоторые "времена" могут быть невалидны.
            // Фоллбек: делаем простой "сутки от ts" (не астрономично, но UI не ломается).
            warn('fallback: using ts-based 24h anchors');
            const start = ms(ts - (ts % 86400_000));
            const end = ms(start + 86400_000);
            const E = start;
            const N = ms(start + 6 * 3600_000);
            const W = ms(start + 12 * 3600_000);
            const S = ms(start + 18 * 3600_000);
            const E_next = end;
            return { start: E, end: E_next, E, N, W, S, E_next };
        }

        // день цикла — тот, чей sunrise является началом
        const startDay = new Date(d);
        if (ts < aToday.sunrise) startDay.setDate(startDay.getDate() - 1);

        const a0 = getAnchorTimes(startDay, lat, lon);
        if (!a0) {
            warn('fallback: failed anchors for startDay', { startDay: startDay.toISOString() });
            const start = ms(ts - (ts % 86400_000));
            const end = ms(start + 86400_000);
            return { start, end, E: start, N: ms(start + 6 * 3600_000), W: ms(start + 12 * 3600_000), S: ms(start + 18 * 3600_000), E_next: end };
        }

        const nextDay = new Date(startDay);
        nextDay.setDate(nextDay.getDate() + 1);

        const a1 = getAnchorTimes(nextDay, lat, lon);
        if (!a1) {
            warn('fallback: failed anchors for nextDay', { nextDay: nextDay.toISOString() });
            const start = a0.sunrise;
            const end = ms(start + 86400_000);
            return { start, end, E: start, N: ms(start + 6 * 3600_000), W: ms(start + 12 * 3600_000), S: ms(start + 18 * 3600_000), E_next: end };
        }

        // S (nadir) берём из nextDay, чтобы он был между sunset и next sunrise
        const anchors: Anchors = {
            start: a0.sunrise,
            end: a1.sunrise,

            E: a0.sunrise,
            N: a0.solarNoon,
            W: a0.sunset,
            S: a1.nadir,

            E_next: a1.sunrise,
        };

        // sanity: порядок событий в сутках (может ломаться на экстремальных широтах)
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
