import { Temporal } from '@js-temporal/polyfill';
import { fromDay, fromGregorianDay, yearStart, correctionDays, notation, PHRASES, calendarPeriods } from '../calendar/core';
import { CALENDAR_EPOCH_DAY } from '../calendar/epoch';
import { civilDayAt } from '../calendar/events';
import { DREAMSPELL_TONES, HARMONIC_ACTIONS } from '../calendar/dreamspell';
import { CHAKRAS } from '../calendar/chakras';

export const DAY_MS = 86400000;
export function localInstant(ts: number, timezone: string) {
  return Temporal.Instant.fromEpochMilliseconds(ts).toZonedDateTimeISO(timezone);
}
export function dayStart(day: number, timezone: string): number {
  const date = fromGregorianDay(day);
  // PlainDate.toZonedDateTime finds the first valid instant, including midnight gaps.
  return Temporal.PlainDate.from(date).toZonedDateTime(timezone).epochMilliseconds;
}
export function period(start: number, end: number, timezone: string) {
  const first = start + CALENDAR_EPOCH_DAY, after = end + CALENDAR_EPOCH_DAY;
  return { startDate: Temporal.PlainDate.from(fromGregorianDay(first)).toString(),
    endDateExclusive: Temporal.PlainDate.from(fromGregorianDay(after)).toString(),
    startTimestamp: dayStart(first, timezone) / 1000, endTimestampExclusive: dayStart(after, timezone) / 1000,
    calendarDays: end - start };
}
export function harmonicAt(ts: number, timezone: string) {
  const day = civilDayAt(ts, timezone) - CALENDAR_EPOCH_DAY;
  const date = fromDay(day), correction = correctionDays(date), start = yearStart(date);
  const free = date.moon === 14;
  const week = free ? null : Math.floor((date.day - 1) / 7) + 1;
  const weekday = free ? null : (date.day - 1) % 7 + 1;
  const monthStart = free ? null : start + correction + (date.moon - 1) * 28;
  const yearName = date.wave ? DREAMSPELL_TONES[date.year - 1] : PHRASES[date.phrase - 1] === 4 ? HARMONIC_ACTIONS[date.year - 1] : null;
  return { notation: notation(date), absoluteDay: day, state: free ? 'free_day' : 'regular',
    greatCycle: date.gc, age: { number: date.phrase, type: PHRASES[date.phrase - 1] },
    wave: { number: date.wave === 0 ? null : date.wave, label: date.wave === 0 ? 'X' : String(date.wave) },
    year: { number: date.year, name: yearName, days: 364 + correction, correctionDays: correction },
    month: free ? null : { number: date.moon, name: DREAMSPELL_TONES[date.moon - 1] },
    week: week === null ? null : { number: week, name: HARMONIC_ACTIONS[week - 1], direction: ['East', 'North', 'West', 'South'][week - 1] },
    day: free ? null : { number: date.day, weekday, symbolicName: CHAKRAS[weekday! - 1].name },
    freeDay: free ? { number: date.day, label: correction === 1 ? 'S' : `S${date.day}`, count: correction } : null,
    isDayOutOfTime: free, isEndOfWeek: !free && weekday === 7, isEndOfMonth: !free && date.day === 28,
    isEndOfYear: day === start + 363 + correction,
    boundaries: { day: period(day, day + 1, timezone), year: period(start, start + 364 + correction, timezone),
      month: monthStart === null ? null : period(monthStart, monthStart + 28, timezone),
      week: monthStart === null ? null : period(monthStart + (week! - 1) * 7, monthStart + week! * 7, timezone),
      freePeriod: free ? period(start, start + correction, timezone) : null } };
}
export function longCyclesAt(ts: number, timezone: string) {
  const day = civilDayAt(ts, timezone) - CALENDAR_EPOCH_DAY;
  const date = fromDay(day);
  return Object.fromEntries(Object.entries(calendarPeriods(date)).map(([name, span]) => [name, {
    ...period(span.start, span.end, timezone), elapsedCalendarDays: day - span.start,
    fraction: (day - span.start) / (span.end - span.start)
  }]));
}
