import { CYCLES, cycleDescriptions, type CycleContext } from './cycles';
import { harmonicAt, localInstant, DAY_MS, dayStart } from './calendar';
import { fromDay, fromGregorianDay, gregorianDay, yearStart, correctionDays, type CalendarYear } from '../calendar/core';
import { CALENDAR_EPOCH_DAY } from '../calendar/epoch';
import { objects, isReferenceLikeKind, type ObjId } from '../catalog';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
const bad = (message: string): never => { throw new ApiError(400, 'invalid_parameter', message); };
const MIN = gregorianDay(-9999, 1, 1) * DAY_MS;
const MAX = gregorianDay(10000, 1, 1) * DAY_MS;
function numeric(raw: string | null, name: string): number {
  if (raw === null || !/^-?\d+(?:\.\d+)?$/.test(raw)) return bad(`${name} must be a decimal number.`);
  const value = Number(raw);
  if (!Number.isFinite(value)) return bad(`${name} must be finite.`);
  return value;
}
function secondsToMilliseconds(raw: string | null, name: string): number {
  if (raw === null || !/^-?\d+(?:\.\d{1,3})?$/.test(raw)) return bad(`${name} must be decimal seconds with at most three fractional digits.`);
  return Math.round(numeric(raw, name) * 1000);
}
export function timestamp(raw: string | null, name = 'timestamp'): number {
  const ms = secondsToMilliseconds(raw, name);
  if (!Number.isSafeInteger(ms) || ms < MIN || ms >= MAX) return bad(`${name} must be Unix seconds in Gregorian years -9999 through 9999; milliseconds are not accepted.`);
  return ms;
}
function integer(q: URLSearchParams, name: string) {
  const value = numeric(q.get(name), name);
  if (!Number.isSafeInteger(value)) return bad(`${name} must be an integer.`);
  return value;
}
function options(q: URLSearchParams): { context: Omit<CycleContext, 'ts'>; include: string[]; labels: boolean } {
  const timezone = q.get('timezone') ?? 'UTC';
  const rawLabels = q.get('labels') ?? 'false';
  if (!['true', 'false'].includes(rawLabels)) return bad('labels must be true or false.');
  const labels = rawLabels === 'true';
  try {
    if (/^[+-]/.test(timezone)) return bad('timezone must be an IANA time zone.');
    new Intl.DateTimeFormat('en-US', {timeZone: timezone});
    localInstant(0, timezone);
  } catch { return bad('timezone must be a supported IANA time zone.'); }
  const include = q.has('include') ? q.get('include')!.split(',') : [];
  if (include.some(id => !CYCLES.has(id))) throw new ApiError(400, 'unknown_cycle', 'Unknown or empty cycle identifier. See /api/v1/cycles.');
  if (new Set(include).size !== include.length) return bad('include must not contain duplicates.');
  const context: Omit<CycleContext, 'ts'> = {timezone};
  if (include.includes('diurnal')) {
    for (const name of ['latitude', 'longitude'] as const) {
      const value = numeric(q.get(name), name), limit = name === 'latitude' ? 90 : 180;
      if (Math.abs(value) > limit) return bad(`${name} must be between -${limit} and ${limit}.`);
      context[name] = value;
    }
    const target = q.get('target') ?? 'Sun';
    if (!Object.hasOwn(objects, target) || target === 'Earth') return bad('target must be a catalog object other than Earth.');
    context.target = target as ObjId;
  } else if (['latitude', 'longitude', 'target'].some(key => q.has(key))) return bad('latitude, longitude and target require include=diurnal.');
  if (include.includes('plato')) {
    const looker = q.get('looker') ?? 'ref:polaris';
    if (!Object.hasOwn(objects, looker) || !isReferenceLikeKind(objects[looker as ObjId]!.kind)) return bad('looker must be a catalog reference.');
    context.looker = looker as ObjId;
  } else if (q.has('looker')) return bad('looker requires include=plato.');
  return {context, include, labels};
}
function moment(ts: number, opts: ReturnType<typeof options>) {
  const local = localInstant(ts, opts.context.timezone);
  if (local.year < -9999 || local.year > 9999) return bad('Local Gregorian year is outside -9999 through 9999.');
  const gregorian = fromGregorianDay(gregorianDay(local.year, local.month, local.day));
  const cycles = Object.fromEntries(opts.include.map(id => {
    const cycle = CYCLES.get(id)!;
    if (cycle.gregorianYears && (local.year < cycle.gregorianYears[0] || local.year > cycle.gregorianYears[1])) {
      throw new ApiError(422, 'unsupported_date', `${id} supports Gregorian years ${cycle.gregorianYears.join(' through ')}.`);
    }
    return [id, cycle.evaluate({...opts.context, ts})];
  }));
  return { timestamp: ts / 1000, timezone: opts.context.timezone, utcDatetime: new Date(ts).toISOString(),
    local: {datetime: local.toString({timeZoneName: 'never', calendarName: 'never'}), date: local.toPlainDate().toString(), time: local.toPlainTime().toString(), offset: local.offset},
    gregorian, harmonic: harmonicAt(ts, opts.context.timezone, opts.labels), ...(opts.include.length ? {cycles} : {}) };
}
const COMMON = ['timezone', 'include', 'labels', 'latitude', 'longitude', 'target', 'looker'];
/** No clock access or UI state is allowed below this request boundary. */
export function queryApi(url: URL, clock: () => number = Date.now): unknown {
  const q = url.searchParams;
  const mode = url.pathname;
  const extra = mode === '/api/v1/moment' ? ['timestamp'] : mode === '/api/v1/range' ? ['start', 'end', 'step'] : mode === '/api/v1/year' ? ['timestamp', 'gc', 'age', 'wave', 'year'] : [];
  if (!['/api/v1/moment', '/api/v1/range', '/api/v1/year', '/api/v1/cycles'].includes(mode)) throw new ApiError(404, 'not_found', 'Unknown API endpoint.');
  for (const key of q.keys()) {
    if (!(mode === '/api/v1/cycles' ? [] : [...COMMON, ...extra]).includes(key)) return bad(`Unsupported parameter: ${key}.`);
    if (q.getAll(key).length > 1) return bad(`Duplicate parameter: ${key}.`);
  }
  if (mode === '/api/v1/cycles') return cycleDescriptions();
  const opts = options(q);
  if (mode === '/api/v1/moment') return moment(q.has('timestamp') ? timestamp(q.get('timestamp')) : timestamp(String(clock() / 1000)), opts);
  let samples: number[];
  if (mode === '/api/v1/range') {
    const start = timestamp(q.get('start'), 'start'), end = timestamp(q.get('end'), 'end');
    const step = q.has('step') ? secondsToMilliseconds(q.get('step'), 'step') : DAY_MS;
    if (step < 1000 || !Number.isSafeInteger(step) || end <= start) return bad('Require end > start and step >= 1 second with millisecond precision.');
    const count = Math.ceil((end - start) / step);
    const expensive = opts.include.some(id => id !== 'harmonic_long_cycles');
    const max = expensive ? 16 : 512;
    if (count > max || (expensive && count * Math.max(1, opts.include.length) > 128)) throw new ApiError(400, 'too_many_samples', `Maximum ${max} samples and 128 astronomical cycle evaluations per request.`);
    samples = Array.from({length: count}, (_, i) => start + i * step);
  } else {
    const coordinates = ['gc', 'age', 'wave', 'year'];
    let value: CalendarYear;
    if (coordinates.some(key => q.has(key))) {
      if (q.has('timestamp') || !coordinates.every(key => q.has(key))) return bad('Supply all gc, age, wave, year coordinates, or timestamp, but not both. wave=0 means X.');
      value = {gc: integer(q, 'gc'), phrase: integer(q, 'age'), wave: integer(q, 'wave'), year: integer(q, 'year')};
    } else {
      const ts = q.has('timestamp') ? timestamp(q.get('timestamp')) : timestamp(String(clock() / 1000));
      const date = localInstant(ts, opts.context.timezone);
      const resolved = fromDay(gregorianDay(date.year, date.month, date.day) - CALENDAR_EPOCH_DAY);
      value = {gc: resolved.gc, phrase: resolved.phrase, wave: resolved.wave, year: resolved.year};
    }
    let first: number, length: number;
    try { first = yearStart(value); length = 364 + correctionDays(value); }
    catch { return bad('Invalid harmonic year coordinates.'); }
    if (opts.include.some(id => id !== 'harmonic_long_cycles')) return bad('Year samples support harmonic_long_cycles only. Use /range for astronomical samples.');
    const civil = first + CALENDAR_EPOCH_DAY;
    if (civil * DAY_MS < MIN || (civil + length) * DAY_MS > MAX) return bad('Year extends outside supported Gregorian years -9999 through 9999.');
    // A skipped civil date has no absolute instant; retain it explicitly in the year output.
    const days = Array.from({length}, (_, i) => {
      const day = civil + i, ts = dayStart(day, opts.context.timezone);
      const date = fromGregorianDay(day), actual = localInstant(ts, opts.context.timezone);
      const skipped = gregorianDay(actual.year, actual.month, actual.day) !== day;
      return skipped ? {gregorian: date, skipped: true, timestamp: null} : {skipped: false, ...moment(ts, opts)};
    });
    // The core associates a preceding free period with the next year's coordinates.
    // Keep that association for lookup, but expose those dates outside the 364-day year.
    const freeCount = length - 364;
    return {timezone: opts.context.timezone, calendar: 'harmonic', coordinates: value, calendarDays: 364,
      freeDays: days.slice(0, freeCount), samples: days.slice(freeCount)};
  }
  return { timezone: opts.context.timezone, endExclusive: true, samples: samples.map(ts => moment(ts, opts)) };
}
