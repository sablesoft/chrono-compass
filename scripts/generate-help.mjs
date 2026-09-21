import fs from 'node:fs/promises';
import path from 'node:path';
import MarkdownIt from 'markdown-it';

const ROOT = process.cwd();
const DOCS_ROOT = path.join(ROOT, 'public', 'docs');
const DIST_ROOT = path.join(ROOT, 'dist');
const HELP_ROOT = path.join(DIST_ROOT, 'help');
const LABELS = { en: 'English', ru: 'Русский' };
const CATEGORY_LABELS = {
  en: {
    overview: 'Project & concepts',
    calendars: 'Calendars',
    cycles: 'Astronomical cycles',
    wheels: 'Wheel concepts',
    dev: 'Developer documentation'
  },
  ru: {
    overview: 'О проекте и концепции',
    calendars: 'Календари',
    cycles: 'Астрономические циклы',
    wheels: 'Концепции колёс',
    dev: 'Документация для разработчиков'
  }
};

function categoryFor(relativePath) {
  if (relativePath.startsWith('calendars/')) return 'calendars';
  if (relativePath.startsWith('cycles/')) return 'cycles';
  if (relativePath.startsWith('concept/')) return 'wheels';
  if (relativePath.startsWith('dev/')) return 'dev';
  return 'overview';
}

function categoryOrder(category) {
  return ['overview', 'calendars', 'cycles', 'wheels', 'dev'].indexOf(category);
}

function categoryLabel(lang, category) {
  return CATEGORY_LABELS[lang]?.[category] || CATEGORY_LABELS.en[category] || category;
}

function renderCategorySections(items, lang, includePaths = true) {
  const groups = new Map();
  for (const item of items) {
    const category = categoryFor(item.relativePath);
    const bucket = groups.get(category) || [];
    bucket.push(item);
    groups.set(category, bucket);
  }

  return Array.from(groups.entries())
    .sort((a, b) => categoryOrder(a[0]) - categoryOrder(b[0]))
    .map(([category, group]) => {
      const cards = group.map(item => {
        const pathLine = includePaths
          ? '<div class="docPath">' + escapeHtml(item.relativePath) + '</div>'
          : '';
        return '<li class="docCard"><a href="' + helpUrl(lang, item.relativePath) + '">' +
          escapeHtml(item.title) + '</a>' + pathLine + '</li>';
      }).join('');
      return '<section class="docCategory' + (category === 'dev' ? ' devCategory' : '') + '">' +
        '<h2>' + escapeHtml(categoryLabel(lang, category)) + '</h2>' +
        (category === 'dev'
          ? '<p class="categoryNote">' + escapeHtml(lang === 'ru'
              ? 'Рабочие заметки, планы и внутренняя техническая документация.'
              : 'Working notes, plans, and internal technical documentation.') + '</p>'
          : '') +
        '<ul class="docCards">' + cards + '</ul></section>';
    })
    .join('\n');
}

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
    '<header class="appHeader">',
    '<div class="headerBar">',
    '<a class="logoLink" href="/#calendar" aria-label="Chrono Compass"><img class="logo" src="/logo-transparent-512.svg" alt=""></a>',
    '<a class="title" href="/#calendar">Chrono Compass</a>',
    '<div class="headerSpacer" aria-hidden="true"></div>',
    '<div class="headerActions">',
    '<details class="sectionMenu">',
    '<summary title="Sections" aria-label="Sections"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></summary>',
    '<nav aria-label="Sections"><a href="/#calendar">Epoch Calendar</a><a href="/#wheels">Wheels Dashboard</a><a href="/#gregorian">Gregorian Calendar</a><a href="/help/" aria-current="page">Documentation</a></nav>',
    '</details>',
    '<button class="themeButton" type="button" title="Theme" aria-label="Toggle theme">🌙</button>',
    '</div>',
    '</div>',
    '</header>'
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
    '<script>(function(){try{var t=localStorage.getItem("tw_theme");if(t!=="dark"&&t!=="light"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}document.documentElement.dataset.theme=t}catch(e){}})();<\/script>',
    '<style>',
    ':root{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color-scheme:dark;--bg:#0b0c0f;--fg:rgba(255,255,255,.92);--muted:rgba(255,255,255,.65);--panel:#15161b;--panel-border:#23242b;--btn-bg:rgba(231,231,234,.06);--btn-border:rgba(231,231,234,.18);--link:#8f96ff;--link-hover:#a4aaff;--accent-blue:oklch(72% .11 255);--radius-8:8px;--radius-10:10px;--radius-12:12px;--radius-16:16px;--sp-6:6px;--sp-8:8px;--sp-10:10px;--header-logo-size:50px}html[data-theme="light"]{color-scheme:light;--bg:#f7f7f9;--fg:rgba(0,0,0,.9);--muted:rgba(0,0,0,.6);--panel:#fff;--panel-border:#d6d8de;--btn-bg:rgba(0,0,0,.04);--btn-border:rgba(0,0,0,.14);--link:#3b49ff;--link-hover:#2f3dff;--accent-blue:oklch(.587 .153 256.133)}*{box-sizing:border-box}',
    'body{margin:0;background:var(--bg);color:var(--fg);line-height:1.65}a{color:var(--link)}a:hover{color:var(--link-hover)}',
    '.appHeader{position:sticky;top:0;z-index:100;background:color-mix(in oklab,var(--bg),transparent 10%);backdrop-filter:blur(6px);padding:8px 16px 4px}',
    '.headerBar{max-width:2600px;margin:0 auto;display:grid;grid-template-columns:auto auto 1fr auto;grid-template-areas:"logo title spacer actions";align-items:center;gap:var(--sp-10);padding:var(--sp-8) var(--sp-6);border:1px solid var(--panel-border);background:var(--panel);border-radius:var(--radius-16)}',
    '.logoLink{grid-area:logo;width:var(--header-logo-size);height:var(--header-logo-size);display:block}.logo{width:100%;height:100%;display:block}.title{grid-area:title;color:var(--fg);text-decoration:none;font-size:26px;font-weight:800;margin-right:10px}.headerSpacer{grid-area:spacer}.headerActions{grid-area:actions;display:flex;align-items:center;gap:var(--sp-10)}',
    '.sectionMenu{position:relative}.sectionMenu summary{list-style:none;display:grid;place-items:center;cursor:pointer;padding:8px 10px;border-radius:var(--radius-12);border:1px solid var(--btn-border);background:var(--btn-bg);color:var(--fg)}.sectionMenu summary::-webkit-details-marker{display:none}.sectionMenu nav{position:absolute;right:0;top:calc(100% + 8px);width:max-content;max-width:calc(100vw - 40px);padding:6px;border:1px solid var(--panel-border);border-radius:var(--radius-12);background:var(--panel);box-shadow:0 12px 32px #0003;z-index:120}.sectionMenu nav a{display:flex;padding:12px;color:var(--fg);text-decoration:none;border-radius:var(--radius-8);white-space:nowrap}.sectionMenu nav a:hover,.sectionMenu nav a[aria-current="page"]{background:var(--btn-bg)}.sectionMenu nav a[aria-current="page"]{box-shadow:inset 3px 0 var(--accent-blue)}',
    '.themeButton{padding:8px 10px;border-radius:var(--radius-12);border:1px solid var(--btn-border);background:var(--btn-bg);color:var(--fg);cursor:pointer;font:inherit}',
    'main{max-width:920px;margin:0 auto;padding:34px 20px 64px}',
    '.docMeta{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:28px;padding-bottom:16px;border-bottom:1px solid var(--panel-border);flex-wrap:wrap}',
    '.languageLinks{display:flex;gap:8px;flex-wrap:wrap}.languageLinks a{text-decoration:none;padding:6px 9px;border:1px solid var(--btn-border);border-radius:8px}',
    '.languageLinks a[aria-current="page"]{background:var(--btn-bg);color:inherit}',
    'article h1{font-size:clamp(2rem,5vw,3.2rem);line-height:1.12}article h2{margin-top:2.2em}article h3{margin-top:1.7em}',
    'article img{max-width:100%;height:auto}article pre{overflow-x:auto;padding:16px;border:1px solid var(--btn-border);border-radius:10px;background:var(--panel)}',
    'article code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}article table{width:100%;border-collapse:collapse;display:block;overflow-x:auto}',
    'article th,article td{padding:8px 10px;border:1px solid var(--btn-border);vertical-align:top}.docIndex{max-width:1100px}.docCategory{margin:0 0 34px}.docCategory h2{margin-bottom:12px}.docCards{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px}.docCard{margin:0;padding:14px 16px;border:1px solid var(--panel-border);border-radius:12px;background:var(--panel)}.docCard>a{font-weight:700;text-decoration:none}.docPath{margin-top:5px;color:var(--muted);font-size:.78rem;overflow-wrap:anywhere}.devCategory{margin-top:48px;padding-top:28px;border-top:1px dashed var(--panel-border)}.devCategory .docCard{background:color-mix(in oklab,var(--panel),var(--bg) 35%)}.categoryNote{color:var(--muted);margin-top:-4px}',
    'footer{border-top:1px solid var(--panel-border);color:var(--muted);padding:24px 20px 40px;text-align:center}',
    '@media(max-width:640px){:root{--header-logo-size:24px}.appHeader{padding:7px 7px 4px}.headerBar{grid-template-columns:auto 1fr auto;grid-template-areas:"logo title actions";gap:4px;padding:8px}.title{font-size:20px;margin:0}.sectionMenu summary,.themeButton{width:28px;height:28px;padding:0}.sectionMenu summary svg{width:14px;height:14px}}',
    '</style>',
    '<script>(function(){function sync(){var t=document.documentElement.dataset.theme||"dark";document.querySelectorAll(".themeButton").forEach(function(b){b.textContent=t==="dark"?"🌙":"☀️"})}document.addEventListener("DOMContentLoaded",function(){sync();document.querySelectorAll(".themeButton").forEach(function(b){b.addEventListener("click",function(){var next=(document.documentElement.dataset.theme||"dark")==="dark"?"light":"dark";document.documentElement.dataset.theme=next;try{localStorage.setItem("tw_theme",next)}catch(e){}sync()})})})})();<\/script>',
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
    const pageTitle = 'Documentation — ' + (LABELS[lang] || lang.toUpperCase());
    const html = [
      head({
        title: pageTitle,
        description: 'ChronoCompass documentation index.',
        lang,
        canonical: '/help/' + lang + '/',
        alternates: languageDirs.map(function (code) { return { lang: code, href: '/help/' + code + '/' }; })
      }),
      '<body>', nav(),
      '<main class="docIndex"><h1>' + escapeHtml(pageTitle) + '</h1>',
      '<p><a href="/help/">All languages</a></p>',
      renderCategorySections(items, lang, true),
      '</main>',
      '<footer>ChronoCompass documentation</footer></body></html>'
    ].join('\n');
    const output = path.join(HELP_ROOT, lang, 'index.html');
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, html);
  }

  const sections = languageDirs.map(function (lang) {
    const items = entries.filter(function (entry) { return entry.lang === lang; });
    return '<section class="languageSection"><h2><a href="/help/' + lang + '/">Documentation — ' +
      escapeHtml(LABELS[lang] || lang.toUpperCase()) + '</a></h2>' +
      renderCategorySections(items, lang, false) + '</section>';
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

  const robotsLines = ['User-agent: *', 'Allow: /', 'Disallow: /docs/'];
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
