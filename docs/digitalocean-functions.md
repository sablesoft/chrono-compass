# DigitalOcean Functions deployment

The production App Platform application `2c459c23-c7cb-4cce-b9a9-a90bed204938` has a Static Site named `chrono-compass`: source `/`, branch `main`, autodeploy enabled, build `npm ci && npm run build`, output `dist`. Keep this component and its domain settings intact. The installed PWA remains fully offline and never imports the HTTP adapter.

## Source and package

- Calendar/astronomy algorithms remain in `src/lib/calendar` and `src/lib/math`.
- `src/lib/api/response.ts` is the shared JSON error boundary used by the Node server and Functions worker.
- `serverless/src/handler.ts` adapts raw DigitalOcean web events to the same API, with CORS, method/query validation, a per-instance rate guard and isolated calculation deadlines.
- `serverless/project.yml` declares Node 22 functions in package `v1`: `moment`, `range`, `year`, `cycles`, `openapi`. Each invocation has 256 MiB and a 25-second platform deadline; the internal worker budget is at most 20 seconds, with time reserved for an error response.
- `serverless/lib/bundle.cjs` is a generated, self-contained deployment artifact, not hand-maintained duplicate algorithms. It includes pinned runtime dependencies and needs no npm install at invocation time. The manifest records every bundled source input and SHA256 hashes. `npm run build:functions` updates it; `npm run test:functions` rejects stale output.
- Each action's `.include` includes the shared artifact and its small CommonJS `package.json`. This follows DO's restricted remote build layout: only `project.yml`, `lib` and the selected function directory are available. It avoids depending on source files outside the remote build container.

## Commands

```sh
npm ci
npm run check
npm run build:functions
npm run test:functions
npm run test:client
npm run build:production
npm run test:api
```

Functions tests copy each deployable package into an isolated temporary directory without `node_modules`. They cover default UTC/clock, fixed timestamp/timezone, one/multiple cycles, exact parity with the shared API, range/year/registry/OpenAPI, duplicate keys, invalid input, CORS, methods, deadlines, recovery and rate guard. The client test builds the PWA and rejects server/API/Functions code in its output module graph. This is an HTTP service only; no new browser SDK is created.

## Deployment topology

The existing static app is in ATL1, which is not listed as a supported Functions region. The API was therefore deployed as a separate **Functions-only** App Platform application in TOR1, without a persistent service or database:

- App: `chrono-compass-api` (`8faf1383-0c51-4c1a-bd2c-70c32b813924`).
- Component: `chrono-compass-serverless`.
- Source: `sablesoft/chrono-compass`, branch `main`, directory `serverless`, autodeploy enabled.
- Public base URL: `https://chrono-compass-api-cppxh.ondigitalocean.app/api/v1`.
- Initial deployment: `99de9d56-e45e-4d6a-b9f7-f0d6334a14a8`, source `c55a2482b3e04f14962a533315a03c60c008b2dc`.
- Route: `/api`, prefix trimmed before package/action routing.
- The existing `chrono-compass.app` Static Site remains in ATL1. Its `/api` path is not connected to this separate app. No custom API domain or cross-app proxy has been configured.

The following same-app instructions apply only in a Functions-supported region; they are not the current production topology.

## Same-app deployment option

Add a Functions component from `sablesoft/chrono-compass`, source directory `/serverless`, using the reviewed code branch initially (then `main` with autodeploy once released). Name the component `moment-api`. The component is a Functions component, not a Web Service; it does not need an instance plan, `npm start`, a TCP port or a `/healthz` service.

Route the component at `/api`. DO's package/function routing gives:

- `/api/v1/moment`
- `/api/v1/range`
- `/api/v1/year`
- `/api/v1/cycles`
- `/api/v1/openapi`

Keep the Static Site route at `/`. Use a more specific ingress rewrite for `/api/v1/openapi.json` to the Functions path `/v1/openapi` if supported by the active app ingress. This avoids DO's special `.json` action representation, which otherwise returns the whole function response envelope. Verify the rewrite in production; `/api/v1/openapi` is the direct equivalent and works without a rewrite. The existing OpenAPI document remains the protocol reference. Do not claim the `.json` alias works until the deployed rewrite has been checked.

The Node `/healthz` endpoint is not necessary for serverless deployment. Readiness is verified by a successful `/api/v1/moment` response. DO's function context is used only to identify the function and its deadline; credentials, activation context and exception stacks are never returned or logged.

Raw web events preserve duplicate query parameters. The adapter rejects them exactly as the Node service does. All successful and error responses use `no-store`. Only GET and simple CORS OPTIONS are allowed. Catalog and model limitations remain as documented in [Moment API](moment-api.md).

## Price and resource limits

At the time of implementation the official tariff includes 90,000 GiB-seconds per team per month, then $0.0000185 per additional GiB-second; App Platform bandwidth rules also apply. At 256 MiB, 0.1 seconds uses 0.025 GiB-seconds (3.6 million such calls fit in the free compute allowance); one second uses 0.25 GiB-seconds (360,000 calls). These are estimates, not measured production performance or a promise of a zero invoice. Cold starts, workers, heavy cycles and other team functions consume allowance. Platform execution-time billing rounds up to 100 ms.

The warm-instance rate guard defaults to 60 calls per client per minute. It resets on cold starts and is not distributed across containers. It cannot be used as a global rate limit or billing cap. Public serverless compute can incur overage; the owner accepted the disclosed Functions tariff. No persistent server or database is added. Check actual invocation duration/compute usage after initial smoke tests before considering additional infrastructure or a distributed limiter.

## Production smoke tests

```sh
curl -fsS https://chrono-compass-api-cppxh.ondigitalocean.app/api/v1/moment
curl -fsS 'https://chrono-compass-api-cppxh.ondigitalocean.app/api/v1/moment?timestamp=1795521600&timezone=America/Sao_Paulo&include=moon,solar'
curl -fsS https://chrono-compass-api-cppxh.ondigitalocean.app/api/v1/cycles
curl -fsS 'https://chrono-compass-api-cppxh.ondigitalocean.app/api/v1/range?start=1795521600&end=1795694400&step=86400'
curl -fsS 'https://chrono-compass-api-cppxh.ondigitalocean.app/api/v1/year?timestamp=1795521600'
curl -fsS https://chrono-compass-api-cppxh.ondigitalocean.app/api/v1/openapi
```

Verify JSON content types and no-store, fixed timestamp parity, UTC default, unsupported inputs, allowed/disallowed origins, homepage/help routes, and the separate OpenAPI alias. Test again after a cold start/redeployment. Publication is complete only after the live API has returned and validated the expected JSON.

## Live verification (2026-11-25 UTC)

Real HTTPS requests to the deployed application verified:

- Default moment: HTTP 200, current timestamp and UTC, structured Gregorian/harmonic dates and period boundaries.
- Fixed timestamp `1795521600`: UTC `2026-11-24T12:00:00.000Z`; with `America/Sao_Paulo`, local `2026-11-24T09:00:00-03:00`.
- One cycle (`moon`) and three cycles (`moon,solar,harmonic_long_cycles`): HTTP 200, matching requested timestamp.
- Cycle registry: HTTP 200, 32 entries. Range, harmonic year and direct OpenAPI action: HTTP 200.
- Unknown cycle, milliseconds, duplicate timestamp and invalid IANA zone: HTTP 400 with structured errors.
- POST: HTTP 405. Allowed website Origin: HTTP 200. Disallowed Origin: HTTP 403.
- DO normalizes successful OPTIONS to HTTP 200 with an empty body; its gateway also adds CORS headers. The handler enforces Origin rejection and method checks independently of those gateway headers.
- Moment response has `Content-Type: application/json` and `Cache-Control: no-store`.
- Original website still returns HTTP 200.

The `/openapi.json` ingress alias is not configured on the separate app; use `/openapi`. PR #34 was merged as `753e2e3`; the Functions component was switched to `main` with autodeploy enabled and that commit was verified live. Future pushes to `main` automatically rebuild and publish Functions as well as the separate Static Site. Feature-branch pushes do not deploy this production component. No manual `doctl` command or control-panel update is needed for ordinary releases. When API source or its dependencies change, run `npm run build:functions` and commit the generated `serverless/lib/bundle.cjs` and manifest before merging; the remote builder deploys that committed artifact. `npm run test:functions` checks it is current. A successful Git push is not proof of deployment success: wait for the app deployment and smoke-test `/api/v1/moment` after publication.

## Primary references

- [Node.js runtime](https://docs.digitalocean.com/products/functions/reference/runtimes/node-js/)
- [Raw HTTP parameters](https://docs.digitalocean.com/products/functions/reference/parameters-responses/)
- [Functions build layout and include files](https://docs.digitalocean.com/products/functions/reference/build-process/)
- [App Platform Functions](https://docs.digitalocean.com/products/app-platform/how-to/manage-functions/)
- [Functions pricing](https://docs.digitalocean.com/products/functions/details/pricing/)

## Calendar contract update

The revised API defaults to compact numeric calendar positions; `labels=true` adds symbolic names. Regular years are 364 dates with preceding free dates separately in `/year.freeDays`, year positions distinguish `yearInWave` and `yearInX`, and harmonic boundaries omit `calendarDays`. See [Moment API](moment-api.md) for migration and examples. Historical live verification above describes the initial release, not proof that a later PR is deployed.
