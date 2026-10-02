import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { siteOrigin } from './site-origin.mjs';

// Check the actual deployable output, including reciprocal language annotations.
const origin = siteOrigin();
const home = await fs.readFile('dist/index.html', 'utf8');
const robots = await fs.readFile('dist/robots.txt', 'utf8');
const sitemap = await fs.readFile('dist/sitemap.xml', 'utf8');
assert.ok(robots.includes('Sitemap: ' + origin + '/sitemap.xml'));
assert.ok(!home.includes('__SITE_ORIGIN__'));
for (const marker of ['name="description"', 'property="og:title"', 'property="og:image"', '<h1>', 'class="siteIntro"']) assert.ok(home.includes(marker), marker);
const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
assert.equal(new Set(urls).size, urls.length);
assert.ok(urls.includes(origin + '/'));
assert.ok(!sitemap.includes('/screens/'));
const pages = new Map();
for (const url of urls) {
  assert.ok(url.startsWith(origin + '/'));
  assert.ok(!url.includes('#'));
  const html = await fs.readFile(path.join('dist', new URL(url).pathname, 'index.html'), 'utf8');
  assert.ok(html.includes('rel="canonical" href="' + url + '"'), url);
  assert.ok(html.includes('name="description"'), url);
  assert.ok(!/noindex/i.test(html), url);
  pages.set(url, html);
}
for (const [url, html] of pages) {
  for (const [, lang, target] of html.matchAll(/rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)) {
    assert.ok(['en', 'ru', 'pt', 'x-default'].includes(lang), lang);
    assert.ok(pages.has(target), target);
    assert.ok(pages.get(target).includes('href="' + url + '"'), 'Missing reciprocal: ' + url + ' -> ' + target);
  }
}
for (const [, href] of home.matchAll(/href="(\/help\/[^"#]*)"/g)) assert.ok(pages.has(origin + href), href);
assert.ok(!home.includes('hreflang'), 'One multilingual SPA URL is not three localized pages');
assert.ok(!(await fs.readFile('dist/sw.js', 'utf8')).includes('robots.txt'), 'Generated robots must not have a stale precache revision');
const previous = process.env.CHRONO_SITE_ORIGIN;
for (const value of ['https://example.com/path', 'https://example.com/?q=1', 'ftp://example.com', 'https://user:pass@example.com']) {
  process.env.CHRONO_SITE_ORIGIN = value;
  assert.throws(siteOrigin);
}
if (previous === undefined) delete process.env.CHRONO_SITE_ORIGIN;
else process.env.CHRONO_SITE_ORIGIN = previous;
console.log('SEO output checks passed: ' + urls.length + ' canonical pages, crawlable introduction and reciprocal hreflang.');
