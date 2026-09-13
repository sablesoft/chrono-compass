import { gregorianDay, fromDay, correctionDays, notation } from './core';

export const GREGORIAN_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export type GregorianPage = { year: number; month: number };

/** Reuse the core's civil-day conversions so both calendars share one day axis. */
export function gregorianMonth(page: GregorianPage, epoch: number, weekStart: 'Mon' | 'Sun' = 'Mon') {
  if (!Number.isInteger(page.year) || page.year < -9999 || page.year > 9999 ||
      !Number.isInteger(page.month) || page.month < 1 || page.month > 12) {
    throw new RangeError('Choose a year from 10000 BCE to 9999 CE and a valid month.');
  }
  const start = gregorianDay(page.year, page.month, 1);
  const next = gregorianDay(page.year + (page.month === 12 ? 1 : 0), page.month === 12 ? 1 : page.month + 1, 1);
  return {
    // 1970-01-01 was Thursday; shift columns to the selected week start.
    offset: ((start + (weekStart === 'Mon' ? 3 : 4)) % 7 + 7) % 7,
    days: Array.from({length: next - start}, (_, i) => ({
      number: i + 1, absolute: start + i - epoch, address: notation(fromDay(start + i - epoch))
    }))
  };
}

export function moveGregorianMonth(page: GregorianPage, direction: -1 | 1): GregorianPage {
  // Normalize through month indices, since the core converter expects months 1–12.
  const index = page.year * 12 + page.month - 1 + direction;
  return {year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1};
}

export function epochDayLabel(day: number): string {
  const date = fromDay(day);
  return date.moon === 14 ? (correctionDays(date) === 1 ? 'S' : `S${date.day}`) : `M${date.moon} · ${date.day}`;
}
