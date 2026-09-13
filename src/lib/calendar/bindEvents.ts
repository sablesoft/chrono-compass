import { solveBindWheel } from '../math/bind';
import { bind } from '../catalog/wheels/bind';
import { fromGregorianDay, gregorianDay } from './core';
import { civilDayAt, type CalendarEvent } from './events';

const labels: Record<string, string> = {
  E: 'Earth–Sun mid-distance — moving away',
  N: 'Earth aphelion — farthest from the Sun',
  W: 'Earth–Sun mid-distance — moving closer',
  S: 'Earth perihelion — closest to the Sun'
};
const role = bind.roles.find(r => r.focus.some(id => id === 'Sun') && r.target.some(id => id === 'Earth'));
const cache = new Map<number, ReturnType<typeof solveBindWheel>>();

/** Canonical yearly queries keep solver results stable across adjacent calendar pages. */
export function bindEvents(start: number, end: number, epoch: number, timezone: string): { events: CalendarEvent[]; available: boolean } {
  const firstYear = fromGregorianDay(start + epoch).year;
  const lastYear = fromGregorianDay(end + epoch).year;
  if (firstYear < 1001 || lastYear > 2999 || !role) return { events: [], available: false };
  const events: CalendarEvent[] = [];
  for (let year = firstYear - 1; year <= lastYear; year++) {
    let result = cache.get(year);
    if (!result) {
      result = solveBindWheel({wheelType: 'bind', focus: 'Sun', target: 'Earth', meta: role.meta, ts: gregorianDay(year, 7, 1) * 86400000});
      if (cache.size >= 32) cache.delete(cache.keys().next().value!);
      cache.set(year, result);
    }
    if (!result.ok) return { events: [], available: false };
    const primary = result.spokes.filter(s => labels[s.code]);
    if (primary.length !== 4 || primary.some((s, i) => !Number.isFinite(s.ts) || (i > 0 && s.ts <= primary[i - 1].ts))) return {events: [], available: false};
    for (const spoke of primary) {
      const day = civilDayAt(spoke.ts, timezone) - epoch;
      if (day >= start && day <= end) events.push({id: `bind:${year}:${spoke.code}`, icon: '🌍', source: 'Sun Bind: Earth · Astronomy Engine calculation', direction: spoke.code, label: labels[spoke.code], ts: spoke.ts, day});
    }
  }
  return {events: events.sort((a, b) => a.ts - b.ts), available: true};
}
