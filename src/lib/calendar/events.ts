import { gregorianDay } from './core';

export type CalendarEvent = { id: string; showDirection?: boolean; icon: string; source: string; direction: string; label: string; ts: number; day: number };
/** Shared civil-day conversion for the selected location. */
export function civilDayAt(ts: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, era: 'short', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(ts);
  const n = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const year = parts.find(p => p.type === 'era')?.value === 'BC' ? 1 - n('year') : n('year');
  return gregorianDay(year, n('month'), n('day'));
}

/** Existing generic date formatters use the device zone; event details need the selected zone. */
export function calendarEventDetails(event: CalendarEvent, timezone: string): string {
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone, year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).format(event.ts);
  const utc = new Date(event.ts).toISOString().replace('T', ' ').replace('Z', ' UTC');
  return `${event.label} (${event.direction})\n${local} (${timezone})\n${utc}\n${event.source}`;
}

export function calendarEventMarker(event: CalendarEvent): string {
  return event.showDirection === false ? event.icon : `${event.icon}${event.direction}`;
}
