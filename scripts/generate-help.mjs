import fs from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

const ROOT = process.cwd();
const DOCS_ROOT = path.join(ROOT, 'public', 'docs');
const DIST_ROOT = path.join(ROOT, 'dist');
const HELP_ROOT = path.join(DIST_ROOT, 'help');
const LABELS = { en: 'English', ru: 'Русский' };
const SITE_ORIGIN = normalizeOrigin(
  process.env.CHRONO_SITE_ORIGIN ||
  process.env.SITE_ORIGIN ||
  process.env.URL ||
  process.env.DEPLOY_PRIME_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL : '') ||
  process.env.CF_PAGES_URL ||
  ''
);

function normalizeOrigin(value) {
  return value ? value.replace(/\/+$/, '') : '';
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function stripMarkdown(value) {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[\*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleFromMarkdown(markdown, relativePath) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match && match[1]) return stripMarkdown(match[1]);
  const file = path.posix.basename(relativePath, '.md');
  return file.split(/[-_]+/).filter(Boolean).map(function (part) {
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join(' ');
}

function descriptionFromMarkdown(markdown) {
  const blocks = markdown.split(/\n\s*\n/);
  for (const block of blocks) {
    const clean = block.trim();
    if (!clean || clean.startsWith('#') || clean.startsWith('|') || clean.startsWith('- ')) continue;
    const text = stripMarkdown(clean);
    if (text) return text.slice(0, 180);
  }
  return 'ChronoCompass documentation.';
}

async function walk(dir, prefix) {
  const items = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const item of items) {
    const rel = prefix ? prefix + '/' + item.name : item.name;
    const full = path.join(dir, item.name);
    if (item.isDirectory()) files.push(...await walk(full, rel));
    else if (item.isFile() && item.name.endsWith('.md')) files.push(rel);
  }
  return files.sort();
}

function helpUrl(lang, relativePath) {
  return '/help/' + lang + '/' + relativePath.replace(/\.md$/i, '') + '/';
}

function pageFile(lang, relativePath) {
  return path.join(HELP_ROOT, lang, relativePath.replace(/\.md$/i, ''), 'index.html');
}

function absolute(urlPath) {
  return SITE_ORIGIN ? SITE_ORIGIN + urlPath : urlPath;
}

function nav() {
  return [
    '<header class="siteHeader"><div class="siteHeaderInner">',
    '<a class="brand" href="/">Chrono Compass</a>',
    '<nav class="mainNav" aria-label="Main">',
    '<a href="/#calendar">Epoch Calendar</a>',
    '<a href="/#wheels">Wheels Dashboard</a>',
    '<a href="/#gregorian">Gregorian Calendar</a>',
    '<a href="/help/" aria-current="page">Documentation</a>',
    '</nav></div></header>'
  ].join('');
}

function head(options) {
  const alternates = (options.alternates || []).map(function (item) {
    return '<link rel="alternate" hreflang="' + escapeHtml(item.lang) + '" href="' + escapeHtml(absolute(item.href)) + '">';
  }).join('\n  ');
  const xDefault = (options.alternates || []).find(function (item) { return item.lang === 'en'; }) || (options.alternates || [])[0];
  const xDefaultTag = xDefault
    ? '<link rel="alternate" hreflang="x-default" href="' + escapeHtml(absolute(xDefault.href)) + '">'
    : '';
  return [
    '<!doctype html>',
    '<html lang="' + escapeHtml(options.lang) + '">',
    '<head>',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<meta name="robots" content="index,follow">',
    '<title>' + escapeHtml(options.title) + ' · ChronoCompass</title>',
    '<meta name="description" content="' + escapeHtml(options.description) + '">',
    '<link rel="canonical" href="' + escapeHtml(absolute(options.canonical)) + '">',
    alternates,
    xDefaultTag,
    '<link rel="icon" href="/favicon.ico">',
    '<style>',
    ':root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}',
    'body{margin:0;background:#101116;color:#ececf1;line-height:1.65}a{color:#8bb6ff}',
    '.siteHeader{position:sticky;top:0;z-index:10;background:rgba(16,17,22,.94);border-bottom:1px solid #2d303a;backdrop-filter:blur(12px)}',
    '.siteHeaderInner{max-width:1120px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;gap:22px;flex-wrap:wrap}',
    '.brand{color:inherit;text-decoration:none;font-weight:800;font-size:1.1rem;margin-right:auto}',
    '.mainNav{display:flex;gap:6px;flex-wrap:wrap}.mainNav a{color:inherit;text-decoration:none;padding:7px 10px;border-radius:8px}',
    '.mainNav a:hover,.mainNav a[aria-current="page"]{background:#252832}',
    'main{max-width:920px;margin:0 auto;padding:34px 20px 64px}',
    '.docMeta{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid #2d303a;flex-wrap:wrap}',
    '.languageLinks{display:flex;gap:8px;flex-wrap:wrap}.languageLinks a{text-decoration:none;padding:6px 9px;border:1px solid #343845;border-radius:8px}',
    '.languageLinks a[aria-current="page"]{background:#252832;color:inherit}',
    'article h1{font-size:clamp(2rem,5vw,3.2rem);line-height:1.12}article h2{margin-top:2.2em}article h3{margin-top:1.7em}',
    'article img{max-width:100%;height:auto}article pre{overflow-x:auto;padding:16px;border:1px solid #343845;border-radius:10px;background:#171920}',
    'article code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}article table{width:100%;border-collapse:collapse;display:block;overflow-x:auto}',
    'article th,article td{padding:8px 10px;border:1px solid #343845;vertical-align:top}.docIndex ul{padding-left:1.25rem}.docIndex li{margin:.35rem 0}',
    'footer{border-top:1px solid #2d303a;color:#aeb3c0;padding:24px 20px 40px;text-align:center}',
    '@media(prefers-color-scheme:light){body{background:#fff;color:#17191f}.siteHeader{background:rgba(255,255,255,.94);border-color:#dddfe7}.mainNav a:hover,.mainNav a[aria-current="page"],.languageLinks a[aria-current="page"]{background:#eef1f6}.docMeta,footer{border-color:#dddfe7}.languageLinks a,article pre,article th,article td{border-color:#d9dce4}article pre{background:#f6f7f9}a{color:#245bb5}}',
    '</style>',
    '</head>'
  ].join('\n');
}

function languageLinks(entry, byRelative) {
  const same = byRelative.get(entry.relativePath) || [];
  if (same.length < 2) return '';
  const links = same.map(function (item) {
    return '<a href="' + helpUrl(item.lang, item.relativePath) + '"' +
      (item.lang === entry.lang ? ' aria-current="page"' : '') + '>' +
      escapeHtml(LABELS[item.lang] || item.lang.toUpperCase()) + '</a>';
  }).join('');
  return '<nav class="languageLinks" aria-label="Languages">' + links + '</nav>';
}

function rendererFor(entry, lookup) {
  const md = new MarkdownIt({ html: false, linkify: true, typographer: true });
  const defaultLinkOpen = md.renderer.rules.link_open || function (tokens, idx, options, env, self) {
    return self.renderToken(tokens, idx, options);
  };

  md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
    const hrefIndex = tokens[idx].attrIndex('href');
    if (hrefIndex >= 0) {
      const rawHref = tokens[idx].attrs[hrefIndex][1];
      if (rawHref && !/^(?:[a-z]+:|\/|#)/i.test(rawHref)) {
        const parts = rawHref.split('#');
        const hrefPath = parts[0];
        const hash = parts[1] || '';
        if (/\.md$/i.test(hrefPath)) {
          const targetRelative = path.posix.normalize(path.posix.join(path.posix.dirname(entry.relativePath), hrefPath));
          const preferred = lookup.get(entry.lang + ':' + targetRelative) || lookup.get('en:' + targetRelative);
          if (preferred) {
            tokens[idx].attrs[hrefIndex][1] = helpUrl(preferred.lang, preferred.relativePath) + (hash ? '#' + hash : '');
          }
        }
      }
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };
  return md;
}

async function main() {
  const languageDirs = (await fs.readdir(DOCS_ROOT, { withFileTypes: true }))
    .filter(function (item) { return item.isDirectory(); })
    .map(function (item) { return item.name; })
    .sort();

  const entries = [];
  for (const lang of languageDirs) {
    const langRoot = path.join(DOCS_ROOT, lang);
    const files = await walk(langRoot, '');
    for (const relativePath of files) {
      const markdown = await fs.readFile(path.join(langRoot, relativePath), 'utf8');
      entries.push({
        lang,
        relativePath,
        markdown,
        title: titleFromMarkdown(markdown, relativePath),
        description: descriptionFromMarkdown(markdown)
      });
    }
  }

  const lookup = new Map(entries.map(function (entry) { return [entry.lang + ':' + entry.relativePath, entry]; }));
  const byRelative = new Map();
  for (const entry of entries) {
    const same = byRelative.get(entry.relativePath) || [];
    same.push(entry);
    byRelative.set(entry.relativePath, same);
  }

  await fs.rm(HELP_ROOT, { recursive: true, force: true });
  await fs.mkdir(HELP_ROOT, { recursive: true });

  for (const entry of entries) {
    const alternates = (byRelative.get(entry.relativePath) || []).map(function (item) {
      return { lang: item.lang, href: helpUrl(item.lang, item.relativePath) };
    });
    const body = rendererFor(entry, lookup).render(entry.markdown);
    const html = [
      head({ title: entry.title, description: entry.description, lang: entry.lang, canonical: helpUrl(entry.lang, entry.relativePath), alternates }),
      '<body>',
      nav(),
      '<main>',
      '<div class="docMeta">',
      '<a href="/help/' + entry.lang + '/">← ' + escapeHtml(LABELS[entry.lang] || entry.lang.toUpperCase()) + ' documentation</a>',
      languageLinks(entry, byRelative),
      '</div>',
      '<article>' + body + '</article>',
      '</main>',
      '<footer>ChronoCompass documentation</footer>',
      '</body></html>'
    ].join('\n');
    const output = pageFile(entry.lang, entry.relativePath);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, html);
  }

  for (const lang of languageDirs) {
    const items = entries.filter(function (entry) { return entry.lang === lang; });
    const list = items.map(function (entry) {
      return '<li><a href="' + helpUrl(lang, entry.relativePath) + '">' + escapeHtml(entry.title) + '</a><br><small>' + escapeHtml(entry.relativePath) + '</small></li>';
    }).join('\n');
    const html = [
      head({
        title: (LABELS[lang] || lang.toUpperCase()) + ' documentation',
        description: 'ChronoCompass documentation index.',
        lang,
        canonical: '/help/' + lang + '/',
        alternates: languageDirs.map(function (code) { return { lang: code, href: '/help/' + code + '/' }; })
      }),
      '<body>', nav(),
      '<main class="docIndex"><h1>' + escapeHtml(LABELS[lang] || lang.toUpperCase()) + ' documentation</h1>',
      '<p><a href="/help/">All languages</a></p><ul>' + list + '</ul></main>',
      '<footer>ChronoCompass documentation</footer></body></html>'
    ].join('\n');
    const output = path.join(HELP_ROOT, lang, 'index.html');
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, html);
  }

  const sections = languageDirs.map(function (lang) {
    const items = entries.filter(function (entry) { return entry.lang === lang; });
    const list = items.map(function (entry) {
      return '<li><a href="' + helpUrl(lang, entry.relativePath) + '">' + escapeHtml(entry.title) + '</a></li>';
    }).join('');
    return '<section><h2><a href="/help/' + lang + '/">' + escapeHtml(LABELS[lang] || lang.toUpperCase()) + '</a></h2><ul>' + list + '</ul></section>';
  }).join('\n');

  const helpIndex = [
    head({
      title: 'Documentation',
      description: 'ChronoCompass documentation in all available languages.',
      lang: 'en',
      canonical: '/help/',
      alternates: languageDirs.map(function (code) { return { lang: code, href: '/help/' + code + '/' }; })
    }),
    '<body>', nav(),
    '<main class="docIndex"><h1>ChronoCompass Documentation</h1>',
    '<p>Choose a language or open any documentation page below.</p>',
    sections,
    '</main><footer>ChronoCompass documentation</footer></body></html>'
  ].join('\n');
  await fs.writeFile(path.join(HELP_ROOT, 'index.html'), helpIndex);

  const robotsLines = ['User-agent: *', 'Allow: /'];
  if (SITE_ORIGIN) robotsLines.push('Sitemap: ' + SITE_ORIGIN + '/sitemap.xml');
  robotsLines.push('');
  await fs.writeFile(path.join(DIST_ROOT, 'robots.txt'), robotsLines.join('\n'));

  if (SITE_ORIGIN) {
    const urls = ['/','/help/']
      .concat(languageDirs.map(function (lang) { return '/help/' + lang + '/'; }))
      .concat(entries.map(function (entry) { return helpUrl(entry.lang, entry.relativePath); }));
    const sitemap = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urls.map(function (url) { return '  <url><loc>' + escapeHtml(SITE_ORIGIN + url) + '</loc></url>'; }).join('\n'),
      '</urlset>',
      ''
    ].join('\n');
    await fs.writeFile(path.join(DIST_ROOT, 'sitemap.xml'), sitemap);
  } else {
    console.warn('[generate-help] No site origin configured; sitemap.xml was not generated. Set CHRONO_SITE_ORIGIN for production builds.');
  }

  console.log('[generate-help] Generated ' + entries.length + ' documentation pages in ' + languageDirs.length + ' languages.');
}

main().catch(function (error) {
  console.error('[generate-help] Failed:', error);
  process.exitCode = 1;
});
