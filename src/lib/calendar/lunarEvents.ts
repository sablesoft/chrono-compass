import { solveSynodWheel } from '../math/synod';
import { fromGregorianDay } from './core';
import { civilDayAt, type CalendarEvent } from './events';

const phases: Record<string, {icon: string; label: string}> = {
  E: {icon: '🌓', label: 'First quarter Moon'}, N: {icon: '🌕', label: 'Full Moon'},
  W: {icon: '🌗', label: 'Last quarter Moon'}, S: {icon: '🌑', label: 'New Moon'}
};
const cache: Array<Extract<ReturnType<typeof solveSynodWheel>, {ok: true}>> = [];

/** Traverse complete Synod cycles, excluding E_next so each first quarter appears once. */
export function lunarEvents(start: number, end: number, epoch: number, timezone: string): {events: CalendarEvent[]; available: boolean} {
  if (fromGregorianDay(start + epoch).year < 1001 || fromGregorianDay(end + epoch).year > 2999) return {events: [], available: false};
  let cursor = (start + epoch - 2) * 86400000;
  const finish = (end + epoch + 2) * 86400000;
  const events = new Map<string, CalendarEvent>();
  for (let iteration = 0; cursor <= finish && iteration < 32; iteration++) {
    let result = cache.find(r => r.spokes[0].ts <= cursor && r.spokes[16].ts > cursor);
    if (!result) {
      const solved = solveSynodWheel({wheelType: 'synod', looker: 'Sun', focus: 'Earth', target: 'Moon', ts: cursor});
      if (!solved.ok || solved.spokes.length !== 17) return {events: [], available: false};
      result = solved;
      if (cache.length >= 32) cache.shift();
      cache.push(result);
    }
    const next = result.spokes[16].ts + 60000;
    if (!Number.isFinite(next) || next <= cursor) return {events: [], available: false};
    for (const spoke of result.spokes) {
      const phase = phases[spoke.code];
      if (!phase) continue;
      const day = civilDayAt(spoke.ts, timezone) - epoch;
      if (day < start || day > end) continue;
      const id = `lunar:${spoke.ts}:${spoke.code}`;
      events.set(id, {id, showDirection: false, ...phase, direction: spoke.code, source: 'Lunar Synod · Astronomy Engine calculation · rounded to the nearest minute', ts: spoke.ts, day});
    }
    cursor = next;
  }
  if (cursor <= finish) return {events: [], available: false};
  return {events: [...events.values()].sort((a, b) => a.ts - b.ts), available: true};
}
