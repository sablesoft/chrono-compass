# Moment API implementation and verification

Date: 2026-11-24. Branch: `feat/moment-api-v1`. Base: `e5465a6b6673ebac164e71b3104cffebeca9a63f`.

## Checks

| Check | Result |
| --- | --- |
| `npm run check` | PASS; Svelte reports 0 errors and 0 warnings; frontend/server TypeScript passes |
| `npm run build:production` | PASS on Node 22.23.5 and Node 24.22.3 |
| `npm run test:api` | PASS; 11 groups including all 32 cycle IDs, repeatability and actual production-server HTTP |
| `npm run test:calendar` | PASS; all 7,738,379 days of a Great Cycle round-trip |
| `npm run test:calendar:events` | PASS; lunar/Bind/Season layers, civil dates and Gregorian 400-year cycle |
| `npm run test:calendar:print` | PASS; chronology, free-day order modes, locales, layers and appendices |
| `npm run test:seo` | PASS; 54 canonical pages and reciprocal hreflang |
| `git diff --check` | PASS |

API checks cover defaults and one captured clock, seconds/fractional seconds, all timestamp/timezone combinations, canonical UI arithmetic and exact solver spokes, calendar boundaries, S/S1–S4, leap dates, solstice month, Great Cycle boundaries, IANA midnight/DST/history/Apia skipped day, one/multiple cycles, malformed/unknown/duplicate parameters, bounds and bulk limits, JSON Schema response validation, real HTTP status/content types, CORS, method rejection, static/asset routing, rate limiting and forwarded-header spoof rejection, process restart, worker saturation, healthcheck availability during computation, timeout and replacement-worker recovery.

The normal default reference for precession is Polaris, outside the existing solver's exclusion belt. Seasonal output remains approximate; lunar synodic spokes preserve minute rounding. Astronomy requests outside each registry entry's advertised support interval return 422. Heavy combinations can hit the documented computation deadline and return 503 rather than block the HTTP server.

Build emits the existing large-client-chunk and old Browserslist database warnings; they do not fail the build. Docker build was not executed because this workspace has no Docker executable.

## Deliverables and deployment status

- API endpoints: `/api/v1/moment`, `/api/v1/range`, `/api/v1/year`, `/api/v1/cycles`, `/api/v1/openapi.json`.
- [Protocol, model audit, units, limits and deployment instructions](moment-api.md).
- [Generated OpenAPI 3.1](moment-api.openapi.json).
- [Complete UTC, Sao Paulo, free-day and multiple-cycle JSON responses](moment-api.examples.json).
- One Node process serves the existing site and public API; isolated bounded workers perform computations. Docker packaging is supplied as an alternative deployment path.
- No production deployment or merge to main was performed. The current HTTPS homepage returned 200; the current API path returned 404/HTML. Existing production has not been asserted to run this branch.
- Remaining deployment question: confirm the existing DigitalOcean component type. Repository configuration is static-only; dynamic endpoints require a Node Web Service using `npm run build:production` and `npm start`. Runtime CORS and ingress trust settings must match the actual hosting configuration. Production publication requires owner confirmation. Production HTTPS/API routing and restart verification remain pending that deployment.
- No unresolved calendar-rule questions: existing arithmetic and S/S1–S4 notation are preserved.

## Changed files

- `.dockerignore`
- `.env.template`
- `.gitignore`
- `Dockerfile`
- `README.md`
- `docs/moment-api-verification.md`
- `docs/moment-api.examples.json`
- `docs/moment-api.md`
- `docs/moment-api.openapi.json`
- `package-lock.json`
- `package.json`
- `scripts/build-api.mjs`
- `scripts/moment-api-fixture.ts`
- `scripts/moment-api-schema.ts`
- `scripts/test-moment-api.mjs`
- `server/compute.ts`
- `server/index.ts`
- `src/lib/api/calendar.ts`
- `src/lib/api/cycles.ts`
- `src/lib/api/moment.ts`
- `src/lib/calendar/core.ts`
- `src/lib/math/plato.ts`
- `tsconfig.server.json`
- `vite.config.ts`
