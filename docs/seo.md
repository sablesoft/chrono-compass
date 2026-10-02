# Search visibility and static content

## Contract

The interactive application remains a hash-routed, offline-capable SPA. `/` is its single canonical search URL; `#calendar`, `#gregorian` and `#wheels` are application views, not separate sitemap entries. Distinct indexed application routes would require a separate decision about History API routing, static/SSR content, hosting fallbacks and offline navigation. Google advises against fragments for loading distinct indexable content: https://developers.google.com/search/docs/crawling-indexing/javascript/fix-search-javascript

`index.html` contains descriptive metadata, canonical/OpenGraph tags and a short visible introduction with ordinary links to static help. The introduction remains below the mounted app, including with JavaScript enabled: do not hide it from people or make it crawler-only. Interactive page titles may reflect the active view. There are no separate localized homepage URLs, so the homepage must not advertise language alternates for hash/localStorage states.

Reuse the existing Markdown help renderer rather than adding another prerendering stack. It generates full HTML at `/help/<language>/<document>/`, with descriptions, self-canonicals and reciprocal alternates only for available translations. Only registered documentation languages (`en`, `ru`, `pt`) are included; asset folders such as `screens` are not languages. `/help/` is a multilingual directory, not a translation of each language index, and therefore has no translation alternates.

`scripts/site-origin.mjs` supplies the shared canonical origin to Vite and help generation. The default is `https://chrono-compass.app`; only explicit `CHRONO_SITE_ORIGIN` can override it. It must be an HTTP(S) origin without credentials, path, query or fragment. Hosting variables such as `URL` and `CF_PAGES_URL` must not accidentally canonicalize a deployment to a preview domain. Preview indexing/access controls belong to the hosting configuration; canonical tags alone do not prohibit indexing.

Every standard build generates absolute canonical URLs, `sitemap.xml` and the sitemap declaration in `robots.txt`. Raw Markdown `/docs/` remains disallowed; crawlable HTML `/help/` remains allowed. Do not precache robots through Vite PWA: help generation runs after Vite and rewrites that file, invalidating an earlier cache revision. Existing service-worker navigation exclusions for help, sitemap, robots and docs remain required. Never apply a SPA fallback to missing help/search files; missing pages must return 404.

Validation: `npm run check`, `npm run build`, then `npm run test:seo`. The SEO check reads actual build output, verifies canonical sitemap targets exist, language alternates are reciprocal, intro links resolve and robots is not in the service-worker precache.

## Production audit — 2026-10-02

Audited current GitHub main `e03a707` and `https://chrono-compass.app` before deploying this change. Production HTML asset names differ from the latest build; production returned a Last-Modified date of 2026-09-23, so production/main parity is not assumed.

- Homepage: HTTP 200, empty app container in original HTML, title only; no description, canonical, OpenGraph or introductory links.
- Robots: HTTP 200, text/plain; allows `/`, disallows `/docs/`, declares the correct absolute sitemap.
- Sitemap: HTTP 200, XML; all 55 listed URLs returned 200. Includes the incorrect empty `/help/screens/` language index.
- Help indexes and EN/RU Epoch Calendar pages: HTTP 200 with static content, descriptions, absolute self-canonicals and translated-document alternates. Language indexes also incorrectly advertise `hreflang="screens"`. The all-language directory advertises translations without corresponding reciprocal annotation.
- Unknown root/help paths return 404 (not a soft-404 application shell). HTTP root redirects to HTTPS with 301. `/help/en` also serves 200 rather than redirecting to its canonical trailing-slash URL; canonical mitigates duplication, while any redirect change belongs to hosting. `www.chrono-compass.app` did not resolve; this is not required for the configured non-www canonical site.
- No X-Robots-Tag exclusion on sampled successful responses. Requests using ordinary curl, browser and a Googlebot User-Agent succeeded. Python-urllib User-Agent received 403, also when reproduced with curl. This establishes filtering by client characteristics, not successful access by a real verified Googlebot. Cloudflare cookies/headers are present. The web research fetcher could not access the site. Check actual security events before attributing this to a particular Cloudflare rule.
- Actual Google index coverage cannot be established from these HTTP checks; requires Search Console. Neither `.app` nor HTTPS alone explains lack of indexing.

Validation passed: type checks (zero errors/warnings), production build, SEO output checks and Chrome smoke checks at 390px/1440px for all three hash views. The static introduction is visible with and without JavaScript, and no horizontal overflow was detected. Vite reports the existing large-bundle warning; browser binaries were not installed.

After this change the build contains 54 canonical URLs: root, the multilingual help hub, three language indexes and 49 documents.

## Owner actions after merge/deployment

1. Merge the SEO PR and verify the hosting deployment uses the new commit and runs the full `npm run build` (including help generation). Check `/`, `/robots.txt`, `/sitemap.xml` and one EN/RU help page after deployment. Purge affected cached HTML/search files in Cloudflare only if old content remains.
2. In Google Search Console, add/verify the Domain property `chrono-compass.app`. If using DNS verification, place the exact Google-provided TXT record in Cloudflare DNS.
3. Submit `https://chrono-compass.app/sitemap.xml` in Sitemaps. In URL Inspection run Test live URL for `/`, `/help/en/calendars/epoch-calendar/` and `/help/ru/calendars/epoch-calendar/`; verify fetch/render and indexing eligibility, then Request indexing.
4. In Cloudflare security events inspect denied requests for robots, sitemap and help. If verified search bots are challenged/blocked, adjust the specific responsible rule or bot setting to permit verified search-engine crawlers. Do not broadly disable protections or trust a spoofable User-Agent. Repeat Search Console live tests.
5. Check Search Console Page indexing, selected canonical and sitemap processing after Google recrawls. Submission does not guarantee indexing: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
