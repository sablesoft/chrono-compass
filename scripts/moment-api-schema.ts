import { CYCLES, cycleDescriptions } from '../src/lib/api/cycles';
const ref = (name: string) => ({$ref: `#/components/schemas/${name}`});
const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({type: 'object', properties, required, additionalProperties: false});
const num = {type: 'number'}, int = {type: 'integer'}, str = {type: 'string'}, bool = {type: 'boolean'};
const nullable = (schema: unknown) => ({anyOf: [schema, {type: 'null'}]});
const array = (items: unknown) => ({type: 'array', items});
const period = object({startDate: str, endDateExclusive: str, startTimestamp: num, endTimestampExclusive: num});
const schemas = {
  Error: object({error: object({code: str, message: str})}),
  Gregorian: object({year: int, month: {type: 'integer', minimum: 1, maximum: 12}, day: {type: 'integer', minimum: 1, maximum: 31}}),
  Period: period,
  Harmonic: object({notation: str, absoluteDay: int, state: {enum: ['regular', 'free_day']}, greatCycle: int,
    age: object({number: int, type: {enum: [1, 4, 7]}}), wave: object({number: nullable(int), isX: bool, label: str}, ['number', 'isX']),
    year: {...object({yearInWave: nullable({type: 'integer', minimum: 1, maximum: 13}), yearInX: nullable({type: 'integer', minimum: 1, maximum: 7}), name: nullable(str), correctionDays: {enum: [1, 4]}}, ['yearInWave', 'yearInX', 'correctionDays']), oneOf: [
      {properties: {yearInWave: {type: 'integer'}, yearInX: {type: 'null'}}},
      {properties: {yearInWave: {type: 'null'}, yearInX: {type: 'integer'}}}
    ]},
    month: nullable(object({number: int, name: str}, ['number'])),
    week: nullable(object({number: int, weekOfYear: {type: 'integer', minimum: 1, maximum: 52}, name: str, direction: str}, ['number', 'weekOfYear'])),
    day: nullable(object({number: int, weekday: int, dayOfYear: {type: 'integer', minimum: 1, maximum: 364}, symbolicName: str}, ['number', 'weekday', 'dayOfYear'])),
    freeDay: nullable(object({number: int, label: str, count: {enum: [1, 4]}})),
    isDayOutOfTime: bool, isEndOfWeek: bool, isEndOfMonth: bool, isEndOfYear: bool,
    boundaries: object({day: ref('Period'), year: nullable(ref('Period')), month: nullable(ref('Period')), week: nullable(ref('Period')), freePeriod: nullable(ref('Period'))})}),
  Cycle: {type: 'object', required: ['status'], properties: {status: {enum: ['available', 'unavailable']}, reason: str,
    startTimestamp: num, endTimestampExclusive: num, elapsedTimeFraction: num, segment: nullable(str), instant: nullable({type: 'object'}),
    spokes: array(object({code: str, timestamp: num, data: {type: 'object', additionalProperties: {type: ['number', 'string', 'boolean', 'null']}}}))},
    additionalProperties: true, description: 'Wheel cycles include spokes. harmonic_long_cycles instead includes greatCycle, age and wave periods with elapsedCalendarDays and fraction. See registry descriptions and documented units.'},
  Moment: object({timestamp: num, timezone: str, utcDatetime: {type: 'string', description: 'ISO 8601 UTC; signed six-digit extended years for BCE dates.'},
    local: object({datetime: str, date: str, time: str, offset: str}), gregorian: ref('Gregorian'), harmonic: ref('Harmonic'),
    cycles: {type: 'object', propertyNames: {enum: [...CYCLES.keys()]}, additionalProperties: ref('Cycle')}},
    ['timestamp', 'timezone', 'utcDatetime', 'local', 'gregorian', 'harmonic']),
  Range: object({timezone: str, endExclusive: {const: true}, samples: array(ref('Moment'))}),
  Year: object({timezone: str, calendar: {const: 'harmonic'}, coordinates: object({gc: int, phrase: int, wave: int, year: int}),
    calendarDays: {const: 364}, samples: {...array(ref('YearSample')), minItems: 364, maxItems: 364},
    freeDays: {...array(ref('YearSample')), minItems: 1, maxItems: 4}}),
  YearSample: {oneOf: [{type: 'object', required: ['skipped', 'timestamp', 'harmonic'], properties: {skipped: {const: false}, timestamp: num, harmonic: ref('Harmonic'), timezone: str, utcDatetime: str, local: {type: 'object'}, gregorian: ref('Gregorian'), cycles: {type: 'object', additionalProperties: ref('Cycle')}}}, object({gregorian: ref('Gregorian'), skipped: {const: true}, timestamp: {type: 'null'}})]},
  CycleRegistry: object({units: {type: 'object', additionalProperties: str}, cycles: array(object({id: {enum: [...CYCLES.keys()]}, description: str, source: str, parameters: array(str), gregorianYears: nullable({type: 'array', items: int, minItems: 2, maxItems: 2})})), targets: array(str), lookers: array(str)})
};
const params: Record<string, unknown> = {
  timestamp: {type: 'number', description: 'Unix seconds, at most 3 fractional digits; omitted = server clock captured once. Gregorian years -9999..9999. Millisecond timestamps are rejected.'},
  timezone: {type: 'string', default: 'UTC', description: 'IANA zone supported by Node ICU/TZDB; absolute instant is unchanged.'},
  labels: {type: 'boolean', default: false, description: 'true adds symbolic day/month/week/year names, week direction and wave label. Only literal true and false are accepted.'},
  include: {type: 'string', description: `Comma-separated unique cycle IDs: ${[...CYCLES.keys()].join(', ')}. Only requested cycles are evaluated.`},
  latitude: {type: 'number', minimum: -90, maximum: 90, description: 'Required for diurnal; degrees north.'},
  longitude: {type: 'number', minimum: -180, maximum: 180, description: 'Required for diurnal; degrees east.'},
  target: {type: 'string', default: 'Sun', description: 'diurnal target catalog ID; see /cycles.'},
  looker: {type: 'string', default: 'ref:polaris', description: 'plato reference catalog ID; see /cycles.'},
  start: {type: 'number', description: 'Inclusive Unix seconds.'}, end: {type: 'number', description: 'Exclusive Unix seconds.'},
  step: {type: 'number', minimum: 1, default: 86400, description: 'Elapsed seconds between samples, not local calendar days.'},
  gc: {...int, description: 'Great Cycle coordinate, supplied together with age/wave/year.'}, age: int, wave: {...int, description: '0 means X.'}, year: int
};
const common = ['timezone', 'include', 'labels', 'latitude', 'longitude', 'target', 'looker'];
function operation(summary: string, names: string[], schema: string, required: string[] = []) {
  return {summary, parameters: names.map(name => ({name, in: 'query', required: required.includes(name), schema: params[name]})), responses: Object.fromEntries([
    ['200', {description: 'Successful calculation. Cycle status may be unavailable when an existing solver cannot resolve the requested configuration.', content: {'application/json': {schema: ref(schema)}}}],
    ...[400, 403, 404, 405, 414, 422, 429, 500, 503].map(status => [String(status), {description: ({400: 'Invalid, unknown, duplicate or excessive parameters',403: 'Disallowed Origin',404: 'Unknown endpoint',405: 'Method not allowed',414: 'URL too long',422: 'Astronomical date outside supported range',429: 'Rate limit exceeded; Retry-After header',500: 'Internal error',503: 'Busy or calculation timeout; Retry-After header'} as Record<number,string>)[status], content: {'application/json': {schema: ref('Error')}}}])
  ])};
}
export const openapi = {openapi: '3.1.0', info: {title: 'ChronoCompass Moment API', version: '1.1.0', description: 'Public read-only API using the same calendar and wheel solvers as the UI. No authentication. Unknown/duplicate query parameters are rejected. Bounds are half-open. All public timestamps are seconds.'},
  servers: [{url: '/'}], security: [], paths: {
    '/api/v1/moment': {get: operation('State at an absolute instant', ['timestamp', ...common], 'Moment')},
    '/api/v1/range': {get: operation('Samples at fixed elapsed-second intervals; max 512 calendar or 16 astronomical samples, 128 astronomical evaluations', ['start', 'end', 'step', ...common], 'Range', ['start', 'end'])},
    '/api/v1/year': {get: operation('364 regular dates plus separate preceding freeDays; timestamp or all gc/age/wave/year coordinates. Only harmonic_long_cycles may be included. Skipped local dates are explicit.', ['timestamp', 'gc', 'age', 'wave', 'year', 'timezone', 'include', 'labels'], 'Year')},
    '/api/v1/cycles': {get: operation('Available cycles, parameters, units and catalog roles', [], 'CycleRegistry')},
    '/api/v1/openapi.json': {get: {summary: 'This OpenAPI document', responses: {'200': {description: 'OpenAPI 3.1 JSON', content: {'application/json': {schema: {type: 'object'}}}}}}}
  }, components: {schemas}, 'x-cycle-registry': cycleDescriptions()};
