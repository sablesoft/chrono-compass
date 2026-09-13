/** Integer calendar arithmetic; no astronomy, timezone, or UI dependencies. */
export type PhraseType = 1 | 4 | 7;
export type CalendarYear = { gc: number; phrase: number; wave: number; year: number };
export type CalendarDate = CalendarYear & { moon: number; day: number };
export type CalendarPage = CalendarYear & { moon: number };

const pattern = (positions: number[]): PhraseType[] =>
  Array.from({ length: 13 }, (_, i) => positions.includes(i + 1) ? 7 : 4);
const p1 = pattern([7]);
const p2 = pattern([4, 10]);
const p4 = pattern([3, 6, 8, 11]);
const p7 = pattern([1, 3, 5, 7, 9, 11, 13]);
export const PHRASES: readonly PhraseType[] = [1, ...Array<PhraseType>(9).fill(4),
  ...p1, ...p2, ...p4, ...p7, ...p7, ...p4, ...p2, ...p1, ...Array<PhraseType>(8).fill(4)];

// Wave 0 denotes the short X interval, preceding the waves in F1 and following them in F4/F7.
const years: Array<CalendarYear & { start: number; length: number }> = [];
let totalDays = 0;
PHRASES.forEach((type, i) => {
  const waves = type === 1 ? [0, ...Array.from({ length: 13 }, (_, n) => n + 1)]
    : [...Array.from({ length: 13 }, (_, n) => n + 1), 0];
  for (const wave of waves) {
    const count = wave === 0 ? type : 13;
    for (let year = 1; year <= count; year++) {
      const length = year === count ? 368 : 365;
      years.push({ gc: 1, phrase: i + 1, wave, year, start: totalDays, length });
      totalDays += length;
    }
  }
});
export const DAYS_PER_GC = totalDays;
export const YEARS_PER_GC = years.length;
const yearIndex = new Map(years.map((y, i) => [`${y.phrase}/${y.wave}/${y.year}`, i]));

function validateGc(gc: number) {
  if (!Number.isSafeInteger(gc) || Math.abs(gc) > 1000) throw new RangeError('GC must be between −1000 and 1000');
}
function rowFor(value: CalendarYear) {
  validateGc(value.gc);
  const index = yearIndex.get(`${value.phrase}/${value.wave}/${value.year}`);
  if (index === undefined) throw new RangeError('This year does not exist in the selected age');
  return { row: years[index], index };
}
export function correctionDays(value: CalendarYear): number { return rowFor(value).row.length - 364; }
export function yearStart(value: CalendarYear): number {
  return (value.gc - 1) * DAYS_PER_GC + rowFor(value).row.start;
}
export function toDay(value: CalendarDate): number {
  if (!Number.isInteger(value.moon) || value.moon < 1 || value.moon > 14) throw new RangeError('Invalid month');
  const maxDay = value.moon === 14 ? correctionDays(value) : 28;
  if (!Number.isInteger(value.day) || value.day < 1 || value.day > maxDay) throw new RangeError('Invalid day');
  return yearStart(value) + (value.moon === 14 ? 0 : correctionDays(value) + (value.moon - 1) * 28) + value.day - 1;
}
export function fromDay(day: number): CalendarDate {
  if (!Number.isSafeInteger(day)) throw new RangeError('Invalid day number');
  const gc = Math.floor(day / DAYS_PER_GC) + 1;
  validateGc(gc);
  const offset = day - (gc - 1) * DAYS_PER_GC;
  let lo = 0, hi = years.length;
  while (lo + 1 < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (years[mid].start <= offset) lo = mid; else hi = mid;
  }
  const row = years[lo];
  const d = offset - row.start;
  const correction = row.length - 364;
  const regular = d - correction;
  return { gc, phrase: row.phrase, wave: row.wave, year: row.year,
    moon: d < correction ? 14 : Math.floor(regular / 28) + 1, day: d < correction ? d + 1 : regular % 28 + 1 };
}
export function movePage(page: CalendarPage, direction: -1 | 1): CalendarPage {
  const first = toDay({ ...page, day: 1 });
  const next = fromDay(direction === -1 ? first - 1 : first + (page.moon === 14 ? correctionDays(page) : 28));
  return { gc: next.gc, phrase: next.phrase, wave: next.wave, year: next.year, moon: next.moon };
}
export function notation(value: CalendarDate): string {
  toDay(value);
  const prefix = `${value.gc}.${value.phrase}(${PHRASES[value.phrase - 1]}).${value.wave === 0 ? 'X' : value.wave}.${value.year}`;
  return value.moon === 14 ? `${prefix}.0.${correctionDays(value) === 1 ? 'S' : `S${value.day}`}`
    : `${prefix}.${value.moon}.${value.day}`;
}
export function waveOptions(phrase: number): number[] {
  if (!Number.isInteger(phrase) || phrase < 1 || phrase > PHRASES.length) return [];
  return PHRASES[phrase - 1] === 1 ? [0, ...Array.from({length: 13}, (_, i) => i + 1)]
    : [...Array.from({length: 13}, (_, i) => i + 1), 0];
}
export function yearCount(phrase: number, wave: number): number {
  return wave === 0 ? PHRASES[phrase - 1] : 13;
}

/** Proleptic Gregorian date to days since 1970-01-01, with astronomical year numbering. */
export function gregorianDay(year: number, month: number, day: number): number {
  const y = year - (month <= 2 ? 1 : 0);
  const era = Math.floor(y / 400);
  const yo = y - era * 400;
  const m = month + (month > 2 ? -3 : 9);
  return era * 146097 + yo * 365 + Math.floor(yo / 4) - Math.floor(yo / 100)
    + Math.floor((153 * m + 2) / 5) + day - 1 - 719468;
}
export function fromGregorianDay(value: number): { year: number; month: number; day: number } {
  const z = value + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yo = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yo + era * 400;
  const doy = doe - (365 * yo + Math.floor(yo / 4) - Math.floor(yo / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp + (mp < 10 ? 3 : -9);
  return { year: y + (month <= 2 ? 1 : 0), month, day };
}
