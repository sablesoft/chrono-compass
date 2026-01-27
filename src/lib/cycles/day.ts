import SunCalc from 'suncalc';
import type { Anchors } from './spokes';
import { clamp01 } from './spokes';
import {angleFromAnchors} from "./angle";

function segProgress(ts: number, a0: number, a1: number) {
    if (a1 === a0) return 0;
    return clamp01((ts - a0) / (a1 - a0));
}

function getAnchorTimes(day: Date, lat: number, lon: number) {
    const t = SunCalc.getTimes(day, lat, lon);
    return {
        sunrise: t.sunrise.getTime(),
        solarNoon: t.solarNoon.getTime(),
        sunset: t.sunset.getTime(),
        nadir: t.nadir.getTime()
    };
}

// Суточный цикл: sunrise -> next sunrise
export function getDayAnchors(ts: number, lat: number, lon: number): Anchors {
    const d = new Date(ts);
    const aToday = getAnchorTimes(d, lat, lon);

    // день цикла — тот, чей sunrise является началом
    const startDay = new Date(d);
    if (ts < aToday.sunrise) startDay.setDate(startDay.getDate() - 1);

    const a0 = getAnchorTimes(startDay, lat, lon);
    const nextDay = new Date(startDay);
    nextDay.setDate(nextDay.getDate() + 1);
    const a1 = getAnchorTimes(nextDay, lat, lon);

    // S (nadir) берём из nextDay, чтобы он был между sunset и next sunrise
    return {
        start: a0.sunrise,
        end: a1.sunrise,

        E: a0.sunrise,
        N: a0.solarNoon,
        W: a0.sunset,
        S: a1.nadir,

        E_next: a1.sunrise
    };
}

export const angleFromDayAnchors = angleFromAnchors;
