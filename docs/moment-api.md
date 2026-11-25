# ChronoCompass Moment API v1

Public read-only HTTP API, without mandatory authentication. It calls the same pure calendar core and wheel solvers as the Svelte interface. The Node service can serve both the compiled website and API; no separate database or external ephemeris service is required.

## Calendar rules established by the existing implementation

Sources: `src/lib/calendar/core.ts`, `epoch.ts`, `events.ts`, `dreamspell.ts`, `chakras.ts`, `src/components/Calendar.svelte`, and `public/docs/en/calendars/epoch-calendar.md`.

- Fixed civil epoch: proleptic Gregorian **-0554-12-22** (555 BCE), using astronomical year numbering; year zero exists.
- Every calendar year has exactly thirteen 28-day months: **364 regular days**. A separate free period precedes it: normally **S**, or **S1–S4** before the last year of each wave/X interval. The core represents a 365/368-day lookup interval including that preceding period; this is not the calendar year length. This schedule is independent of Gregorian leap years. The first one-year A1 X interval has four free days.
- Free days are outside the calendar year and have no month/day-of-month/week/weekday or yearly day/week number. The core associates their lookup coordinates with the following regular year; this association does not mean membership in that calendar year. They use `state="free_day"`. The core's internal `moon=14` sentinel is never exposed as a month number. Notation retains the existing `.0.S` / `.0.S1` format.
- Each month has four seven-day weeks. Week names/actions and direction labels, Dreamspell positional year/month names, and chakra weekday labels come from existing constants. Names are symbolic, rather than a traditional Maya date conversion. Year names are null where no name is defined.
- Coordinates: Great Cycle (`gc`), age (`phrase` internally, `age` in query), wave (0 = X), year within wave/X, month, day. An A1 age begins with X; A4/A7 ages end with X. `calendarPeriods` derives boundaries from the existing year table, without a second correction schedule.
- Great Cycle: 122 ages, 21,187 years, 7,738,379 days. Age types and the palindrome are exactly those in `PHRASES`. No new leap rule, solstice alignment, epoch or day-count convention is introduced.
- The older epoch research document uses “N” for the ordinary free day in one paragraph; the actual core, tests, UI and current calendar guide consistently use **S**. The API preserves **S**.

## Endpoints

| GET endpoint | Purpose |
| --- | --- |
| `/api/v1/moment` | Calendar state at one absolute instant |
| `/api/v1/range` | Samples at fixed elapsed-time intervals |
| `/api/v1/year` | 364 regular dates, with preceding free dates in a separate array |
| `/api/v1/cycles` | Cycle IDs, descriptions, accepted parameters, date limits, units and catalog role IDs |
| `/api/v1/openapi.json` | OpenAPI 3.1 document |
| `/healthz` | Process liveness; independent of calculation workers |

Only GET and CORS OPTIONS are supported for API routes. Unknown API paths never fall back to the SPA. Website routes retain the SPA fallback; absent asset files return 404. The PWA service worker excludes `/api` and `/healthz` from navigation fallback.

### Moment parameters

| Parameter | Default | Meaning |
| --- | --- | --- |
| `timestamp` | Server time captured once at request arrival | Unix **seconds**, optional decimal fraction of up to three digits; not milliseconds |
| `timezone` | `UTC` | IANA zone accepted by the Node ICU/TZDB and Temporal runtime |
| `labels` | `false` | Literal `true` adds all symbolic names, week direction and wave label; literal `false` omits them. Supported by moment, range and year |
| `include` | Omitted; no optional cycle computations | Comma-separated, distinct, case-sensitive cycle IDs |
| `latitude`, `longitude` | Required only for `diurnal` | Degrees north/east; ranges −90..90 and −180..180 |
| `target` | `Sun`, only for `diurnal` | Catalog object ID other than Earth; see `/cycles` |
| `looker` | `ref:polaris`, only for `plato` | Catalog reference ID; see `/cycles` |

Timestamp decimal notation accepts a leading minus and digits, with an optional decimal point; empty strings, scientific notation, infinity, NaN and more than three fractional digits are rejected. Gregorian years **−9999..9999** are supported for basic calendar queries. This explicit range also rejects contemporary millisecond timestamps. A numeric value cannot reveal the caller's intended unit when it is also a valid seconds value; all accepted values are interpreted strictly as seconds.

The timestamp always identifies the same physical instant. Time zone only changes local civil representation and calendar placement. `Intl`'s existing `civilDayAt` is reused for date selection. `@js-temporal/polyfill` supplies exact IANA period boundaries because the existing project had no civil-date-to-instant helper. Midnight gaps start at the first valid instant; repeated midnights choose the first occurrence. Boundaries are half-open `[startTimestamp, endTimestampExclusive)`. A day may contain 23 or 25 hours, or historical offset changes measured in seconds. Pin Node/ICU and dependencies for reproducibility across machines; updating TZDB may change historical/future civil labels, without changing an explicit timestamp.

Examples:

```text
/api/v1/moment
/api/v1/moment?timezone=America/Sao_Paulo
/api/v1/moment?timestamp=1795521600
/api/v1/moment?timestamp=1795521600&timezone=America/Sao_Paulo
/api/v1/moment?timestamp=1795521600&labels=true
/api/v1/moment?timestamp=1795521600&include=moon,solar&labels=true
/api/v1/moment?timestamp=1795521600&include=moon,solar,mercury,harmonic_long_cycles
/api/v1/moment?timestamp=1795521600&include=diurnal&latitude=-23.55&longitude=-46.63
```

### Response structure and units

The complete machine-readable schemas are in [moment-api.openapi.json](moment-api.openapi.json). A complete reproducible example is in [moment-api.examples.json](moment-api.examples.json).

- `timestamp`: actually used Unix seconds, possibly fractional.
- `timezone`: requested IANA zone (UTC by default).
- `utcDatetime`: ISO UTC string; `local` contains the local ISO datetime with offset, date, time and offset including historical seconds when relevant.
- `gregorian`: astronomical year, numeric month and day in the selected zone.
- `harmonic`: notation, continuous day number from the epoch, state, Great Cycle/age/wave/year coordinates, numeric month/week/day or null, optional symbolic names, and `freeDay` or null. `freeDay.number` indexes only the free period, not a fictitious day of month.
- `isDayOutOfTime` is true for **every** free day, including S1–S4. `isEndOfWeek`/`isEndOfMonth` are false on free days. `isEndOfYear` is true on Month 13 day 28; the next date starts the separate free period preceding the next regular year.
- `harmonic.boundaries`: current day, week, month, regular year and (only on free days) free-period boundaries. Each non-null period contains only `startDate`, `endDateExclusive`, `startTimestamp` and `endTimestampExclusive`. Date strings are Gregorian dates in the selected timezone; timestamps are absolute Unix seconds. End bounds are exclusive. `calendarDays` is omitted. Year boundaries span exactly 364 regular dates; year/week/month boundaries are null on free days. Free-period boundaries are null on regular days.
- `cycles`: omitted unless requested. Keys are stable cycle IDs. Each result has `status="available"` or `"unavailable"`; unresolved existing algorithms return a generic reason, rather than a fabricated cycle.
- Wheel data includes start/end timestamps, `elapsedTimeFraction`, current spoke interval `segment`, and the original 17 spokes. Spoke timestamps, including optional `exactTimestamp`, are converted from internal milliseconds to public seconds. Solver rounding is preserved. `segment` may be null within rounding tolerance at a cycle seam; minute rounding can also put the elapsed fraction just outside 0..1 near that seam; it is an interval between spokes, not the UI's centered house label.
- `instant` on synodic cycles contains the original projected `phaseDeg` (0=S, 90=E, 180=N, 270=W), `motion` (`ccw`/`cw`), `distanceAu` and `focusDistAu`. On `diurnal`, it contains the shared horizon instant, including altitude/azimuth, RA, declination and distances. No illumination fraction is invented from angular phase.
- Suffix `Deg`: degrees; `Rad`: radians; `Au`: astronomical units; `Km`: kilometres; `raHours`: hours of right ascension; `Fraction`/`fraction`: dimensionless; day counts: civil days. `exactTimestamp` is seconds. Distance fields on spokes refer to the spoke instant, while `instant` fields refer to the requested timestamp.
- `harmonic_long_cycles`: Great Cycle, age and wave/X boundaries, elapsed **whole calendar days** and calendar-day fraction; no astronomical assumptions.

### Compact calendar fields and labels

Default responses omit `day.symbolicName`, `month.name`, `wave.label`, `week.name`, `week.direction` and `year.name`. `labels=true` restores all six fields where their parent objects exist, using the same UI constants; `year.name` may be null when no name exists. Labels do not select or recompute astronomical cycles. `labels=1`, empty values, other spellings and duplicated `labels` parameters return HTTP 400. The same option applies to every moment inside `/range`, `/year.samples` and `/year.freeDays`.

- `day.number`: day of month, 1–28; `day.weekday`: day of week, 1–7; `day.dayOfYear`: regular day of year, 1–364.
- `week.number`: week of month, 1–4; `week.weekOfYear`: regular week of year, 1–52.
- `year.yearInWave`: 1–13 within the current wave, or null in X.
- `year.yearInX`: position within the current X interval (1–1, 1–4 or 1–7 according to age type), or null in a wave. Exactly one of the two year numbers is null. The ambiguous `year.number` and `year.days` fields are removed.
- `wave.number`: 1–13, or null in X; `wave.isX` identifies X without needing the optional `wave.label`.
- `year.correctionDays`: number of dates in the separately represented preceding free period, 1 or 4. It is not added to the 364-day calendar year. On a free date, year/wave coordinates identify the following regular year's core lookup context.
- `freeDay.label` (`S` / `S1`–`S4`) and `notation` remain machine-readable calendar identifiers, not optional artistic names.
- `/year` request coordinates keep `year` as the existing query coordinate within wave/X; response `coordinates` echoes these lookup coordinates. Moment positions use the explicit fields above.

For Gregorian 2026-11-25 UTC, the default position includes:

```json
{
  "wave": {"number": 13, "isX": false},
  "year": {"yearInWave": 5, "yearInX": null, "correctionDays": 1},
  "month": {"number": 13},
  "week": {"number": 1, "weekOfYear": 49},
  "day": {"number": 4, "weekday": 4, "dayOfYear": 340}
}
```

The regular year starts on 2025-12-21 and ends exclusively on 2026-12-20. Gregorian 2025-12-20 is S, outside that calendar year. A week starting 2026-11-22 and ending exclusively 2026-11-29 includes November 22–28. Local DST can change elapsed seconds between boundaries without changing these civil-date counts.

These owner-approved contract changes replace the initial v1 calendar representation. Existing consumers must migrate the removed fields and `/year` array handling; no compatibility aliases silently retain the old meanings. The OpenAPI document version is 1.1.0; endpoint paths remain `/api/v1`.

### Supported cycles

| IDs | Existing source / interpretation |
| --- | --- |
| `moon` | `solveSynodWheel`, looker Sun, focus Earth, target Moon; spokes rounded to minutes |
| `lunar_anomalistic` | `solveBindWheel`, Earth–Moon distance, catalog duration |
| `lunar_draconic` | `solveNodalWheel`, canonical Sun/Earth/Moon roles |
| `solar` | `solveSeasonWheel`, polynomial tropical approximation; event times are approximate |
| `solar_anomalistic` | `solveBindWheel`, Sun–Earth distance, catalog duration |
| `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `neptune`, `pluto` | `solveSynodWheel`, looker Earth, focus Sun, target named planet |
| Planet ID + `_anomalistic` | `solveBindWheel`, Sun–planet distance, duration reused directly from the catalog |
| Planet ID + `_nodal` | `solveNodalWheel`, looker Earth, focus Sun, target planet |
| `diurnal` | `solveHorizonWheel` + `computeHorizonInstant`, observer latitude/longitude, configurable target |
| `plato` | `solvePlatoWheel`, reference/Earth precession geometry; configurable reference |
| `harmonic_long_cycles` | Existing integer calendar hierarchy |

Canonical profiles expose every implemented family of temporal wheel. Compass, System and Galaxy are spatial views/compositions, rather than additional independent temporal cycles. Arbitrary role permutations from those views are not a new calendar rule or public v1 parameter. Diurnal targets and precession reference IDs are discoverable in `/cycles`.

Astronomy profiles (other than precession) use the existing calendar-layer safety envelope of Gregorian **1001..2999**; this is a conservative API support policy, not a claim of precision throughout that interval. Queries outside a requested cycle's range return 422 before invoking that solver. Precession accepts the basic API date range and passes a fixed epoch-based timeframe reference into the existing solver, avoiding its UI's moving `Date.now()` guard. Solvers may be unavailable near search limits, for some planetary node geometries, at polar locations, or for precession references inside the exclusion belt. A response explicitly reports this limitation; it does not substitute another model. Spoke interpolation and approximate seasonal times are not observational ephemerides. All requested cycles share exactly one timestamp.

To extend the API, add an adapter/description to `src/lib/api/cycles.ts`. Discovery and OpenAPI cycle IDs derive from that registry; do not copy a solver into the API. Regenerate the specification with `npm run build:api`.

### Ranges and years

`/api/v1/range?start=1795521600&end=1795780800&step=86400&timezone=UTC&include=moon`

`start` inclusive and `end` exclusive are required Unix seconds. `step` defaults to 86,400 elapsed seconds (minimum 1 second, millisecond precision). This does **not** mean one local calendar day across DST. Maximum 512 basic/long-calendar samples, or 16 samples and 128 total astronomical cycle evaluations. Invalid or oversized requests fail before computation. All results use the same timezone, include and labels selection, with each sample's own timestamp.

`/api/v1/year?timestamp=1795521600&timezone=UTC`

`/api/v1/year?gc=1&age=1&wave=0&year=1`

Without coordinates, returns the harmonic year containing the timestamp (current server time by default). Alternatively provide **all** `gc,age,wave,year`; `wave=0` denotes X. Coordinates and timestamp are mutually exclusive. On a free date, timestamp lookup selects the following regular year using existing core coordinates. `samples` contains exactly **364 regular dates** and top-level `calendarDays` is always 364. The preceding free period is returned separately as `freeDays` (1 or 4 dates), outside the calendar year. Both arrays are sampled at the **start of each local civil date**. A historically skipped civil date is retained explicitly as `{gregorian, skipped:true, timestamp:null}`. Ordinary samples have `skipped:false` and the moment fields. Only `harmonic_long_cycles` may be included for full-year samples; use bounded `/range` requests for astronomical samples.

## Errors, CORS and resource limits

Errors have JSON shape `{"error":{"code":"invalid_parameter","message":"..."}}`.

| HTTP | Meaning |
| --- | --- |
| 400 | Invalid, unknown, irrelevant or duplicated parameter; unknown/duplicate/empty cycle; excessive sample count |
| 403 | Origin not in the CORS allowlist |
| 404 | Unknown API endpoint or missing asset |
| 405 | Unsupported HTTP method (`Allow` header) |
| 414 | URL exceeds 8192 characters |
| 422 | Requested astronomical cycle does not support the date |
| 429 | Per-client rate limit exceeded; `Retry-After: 60` |
| 500 | Generic internal failure; no exception stack or server secrets exposed |
| 503 | Workers/client map saturated or calculation timeout; `Retry-After: 1` |

Defaults: 60 API requests per client per minute, two reusable isolated calculation workers, a 20-second calculation deadline, 10,000 client buckets, 8192-character URL limit. Excess calculations return 503 instead of creating an unbounded queue. Workers are terminated and replaced after timeout/failure. Health and static routes remain responsive while computations run. Rate limiting is process-local and resets after restart; use ingress limits when operating multiple instances. CORS preflights count against the request limit. Only simple GET requests without custom headers are supported; credentials are not enabled.

`API_CORS_ORIGINS` is a comma-separated exact-origin allowlist; default `https://chrono-compass.app`. Requests without Origin remain public (CORS is not authentication). API responses are `Cache-Control: no-store` with `Vary: Origin` and `nosniff`.

`API_TRUST_PROXY=false` ignores forwarded client headers. Enable only with a single trusted ingress that overwrites or appends the actual peer as the rightmost `X-Forwarded-For` value, and restrict direct access. Confirm the actual DigitalOcean/Cloudflare proxy chain before enabling it; an incompatible proxy setup can aggregate or misidentify clients. No server-only configuration uses a `VITE_` variable.

## Build, test and deployment

```sh
npm ci
npm run check
npm run build:production
npm run test:api
npm run test:calendar
npm run test:calendar:events
npm run test:calendar:print
npm run test:seo
npm start
```

Node 22.18+ or Node 24+; the repository's `.nvmrc` specifies 22. `build:production` builds the unchanged Svelte/Vite frontend plus Node SSR bundles and regenerates OpenAPI. Existing `npm run build` continues to support static-only previews. Production server settings are listed in `.env.template`: `PORT` (8080), `HOST` (0.0.0.0), `API_CORS_ORIGINS`, `API_RATE_LIMIT`, `API_WORKERS`, `API_COMPUTE_TIMEOUT_MS`, `API_TRUST_PROXY`. Environment files are not auto-loaded by the Node server; inject runtime variables through the hosting platform.

Tests use the actual modules and a compiled HTTP server on an ephemeral loopback port: captured clock, combinations/defaults, Gregorian leap dates, free periods, month/week/year/Great Cycle boundaries, timezone changes, DST, historical second offsets, Apia's skipped date, exact spoke parity with UI solvers, every registry entry, deterministic repeat calls, malformed input, schemas, CORS/methods/errors, static routing, process restart, spoof-resistant default rate limiting and calculation timeout. Test examples are written to ignored `tmp/moment-example.json`.

### Existing hosting and approval boundary

The repository contains `.openai/hosting.json` with **static `dist` hosting**. No DigitalOcean App Spec, server, reverse proxy configuration, infrastructure state or credentials were present when implementing this API. The owner confirmed production auto-deploys from main; this does not establish whether the current component can run Node. A static host cannot execute the new dynamic endpoints simply by publishing JSON or SPA routes.

The implementation supports a **single Node Web Service** serving website + API. Configure the existing application component with build command `npm run build:production`, run command `npm start`, port 8080 (or injected `PORT`), HTTP health path `/healthz`, and existing domain/TLS routing. Alternatively build the supplied multi-stage `Dockerfile`; it runs as non-root and includes a health check. It does not create infrastructure or change the current hosting configuration automatically. Keep existing domain/redirect/certificate settings. HTTPS is terminated by DigitalOcean/your existing ingress; Node listens on the internal HTTP port.

Before merging: confirm the current DigitalOcean component type and adjust it to Web Service if it is Static Site; review CORS and trusted-proxy settings. The owner must confirm production publication before merge to main. After authorized deployment verify:

```sh
curl -fsS https://chrono-compass.app/healthz
curl -fsS https://chrono-compass.app/api/v1/moment
curl -fsS 'https://chrono-compass.app/api/v1/moment?timestamp=1795521600&timezone=America/Sao_Paulo&include=moon,solar'
curl -fsS https://chrono-compass.app/api/v1/cycles
curl -fsS https://chrono-compass.app/api/v1/openapi.json
```

Verify a valid HTTPS certificate, JSON content types, the unchanged homepage and `/help/` pages, and repeat fixed/default timestamp checks after a platform restart. Local restart tests verify deterministic fixed inputs; they do not establish production routing/TLS or successful DigitalOcean deployment. Live API URL becomes authoritative only after that deployment and smoke test.

### Read-only production observation (2026-11-24)

HTTPS requests with normal certificate verification succeeded. The homepage returned HTTP 200 and HTML; `/api/v1/moment` returned HTTP 404 and HTML. Headers indicated DigitalOcean App Platform behind Cloudflare (`x-do-app-origin`, `x-rgw-object-type`, `x-amz-request-id`). This is consistent with static hosting, but does not substitute for inspecting the actual App Platform component settings. Production was not modified.

## Preferred deployment for the existing Static Site

The owner selected DigitalOcean Functions to retain static hosting and offline client calculations. See [DigitalOcean Functions deployment](digitalocean-functions.md). The standalone Node service above remains an alternative, not a requirement for the static website.
