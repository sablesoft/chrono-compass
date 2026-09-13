import { solveSeasonWheel } from '../math/season';
import { fromGregorianDay, gregorianDay } from './core';

import { civilDayAt, type CalendarEvent } from './events';
export { civilDayAt, calendarEventDetails, calendarEventMarker } from './events';

const labels: Record<string, string> = {
  E: 'March equinox', N: 'June solstice', W: 'September equinox', S: 'December solstice'
};
const dayMs = 86400000;

/** Adapt the Season wheel's four primary anchors; never use its interpolated spokes. */
export function seasonEvents(start: number, end: number, epoch: number, timezone: string): { events: CalendarEvent[]; available: boolean } {
  const firstYear = fromGregorianDay(start + epoch).year;
  const lastYear = fromGregorianDay(end + epoch).year;
  // Keep the existing modern-year polynomial away from remote GC dates.
  if (firstYear < 1001 || lastYear > 2999) return { events: [], available: false };
  const events: CalendarEvent[] = [];
  for (let year = firstYear - 1; year <= lastYear; year++) {
    const result = solveSeasonWheel({ wheelType: 'season', focus: 'Sun', target: 'Earth', ts: gregorianDay(year, 7, 1) * dayMs });
    if (!result.ok) return { events: [], available: false };
    for (const spoke of result.spokes) {
      const label = labels[spoke.code];
      if (!label) continue;
      const day = civilDayAt(spoke.ts, timezone) - epoch;
      if (day >= start && day <= end) events.push({ id: `season:${year}:${spoke.code}`, icon: '☀', source: 'Approximate Season wheel calculation', direction: spoke.code, label, ts: spoke.ts, day });
    }
  }
  return { events: events.sort((a, b) => a.ts - b.ts), available: true };
}
