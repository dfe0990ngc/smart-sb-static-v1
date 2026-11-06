/**
 * Post-build SEO step (runs after `next build` and the Pagefind index):
 *   out/documents/<id>-<slug>/index.html   one plain, crawlable HTML page per document (title, metadata, text, PDF link)
 *   out/documents/archive/...              static year > month > document link hierarchy
 *   out/sitemap.xml (+ sitemap-N.xml)      every public URL
 *   out/robots.txt
 * Pagefind itself is JavaScript – Google cannot index its results – so these pages are what gets indexed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { MONTHS, ROOT, DATA_DIR, SEO_MIN_YEAR, docPath, getSiteUrl, hasPage, loadDocuments } from './shared.mjs';

const OUT = path.join(ROOT, 'out');
const site = getSiteUrl();
const { docs: allDocs, isSample } = loadDocuments();
const docs = allDocs.filter(hasPage); // only SEO_MIN_YEAR (default 2012) and later get their own page
const today = new Date().toISOString().slice(0, 10);

if (!fs.existsSync(path.join(OUT, 'index.html'))) {
  console.error('[seo] out/index.html not found - run next build first');
  process.exit(1);
}
if (!site) console.warn('[seo] ! NEXT_PUBLIC_SITE_URL is not set (see .env.production) - sitemap.xml and canonical URLs are skipped');
if (isSample) console.warn('[seo] ! sample documents in use - document pages and sitemap entries are skipped');

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const write = (rel, content) => {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
};
const fmtDate = (iso) =>
  new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z'));

/* reuse the site's compiled stylesheet(s) */
const home = fs.readFileSync(path.join(OUT, 'index.html'), 'utf-8');
const cssTags = [...home.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]).join('\n');

const NAV = [['/', 'Home'], ['/sb-members/', 'Members'], ['/documents/', 'Legislations'], ['/latest-updates/', 'News & Updates']];

function page({ title, description, path: urlPath, body, jsonLd }) {
  const canonical = site ? `${site}${urlPath}` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · SMART SB</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="index, follow">
${canonical ? `<link rel="canonical" href="${esc(canonical)}">\n<meta property="og:url" content="${esc(canonical)}">` : ''}
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:site_name" content="SMART-SB">
<link rel="icon" href="/icons/icon-192.png">
${cssTags}
<style>
.seo-nav{display:flex;flex-wrap:wrap;gap:6px 18px;padding:10px 0;font-weight:700;font-size:.9rem}
.seo-nav a{color:var(--primary)}
.seo-crumbs{font-size:.85rem;color:var(--muted);margin-bottom:14px}
.seo-crumbs a{color:var(--primary);text-decoration:underline;text-underline-offset:3px}
.seo-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg,16px);padding:26px}
.seo-meta{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px;margin:18px 0;font-size:.95rem}
.seo-meta dt{font-weight:800;color:var(--muted)}
.seo-actions{margin:20px 0}
.seo-text{white-space:pre-line;line-height:1.7;font-size:.95rem;color:var(--text);margin-top:10px;overflow-wrap:anywhere}
.seo-list{list-style:none;display:grid;gap:8px;margin-top:14px}
.seo-list a{font-weight:700;color:var(--primary)}
.seo-list small{display:block;color:var(--muted)}
</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<header class="site-header" style="position:static">
  <div class="container">
    <a class="brand" href="/" aria-label="SMART-SB Home" style="padding-top:10px">
      <div class="brand-image-mobile" style="margin-right:8px"><img src="/images/lgu-logo.svg" alt="" class="brand-image"><img src="/images/sb-logo.svg" alt="" class="brand-image"></div>
      <span><strong class="text-primary">SMART-SB</strong><small>SANTA CRUZ, DAVAO DEL SUR</small></span>
    </a>
    <nav class="seo-nav" aria-label="Main">${NAV.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</nav>
  </div>
</header>
<main class="section-padding"><div class="container" style="max-width:920px">
${body}
</div></main>
<footer class="site-footer"><div class="container"><div class="footer-bottom" style="border:0;margin:0;padding:0">© ${new Date().getFullYear()} SMART-SB Public Portal · Santa Cruz Sangguniang Bayan</div></div></footer>
</body>
</html>`;
}

const crumbs = (items) =>
  `<nav class="seo-crumbs" aria-label="Breadcrumb">${items.map(([h, l]) => (h ? `<a href="${h}">${esc(l)}</a>` : esc(l))).join(' › ')}</nav>`;

const urls = []; // [path, lastmod]
const MAX_TEXT = 30000;

if (!isSample && docs.length > 0) {
  /* ── one page per document (only when SEO_DOC_PAGES=true) ── */
  for (const d of docs) {
    const p = docPath(d);
    const monthPath = `/documents/archive/${d.year}/${String(d.month_number).padStart(2, '0')}/`;
    const text = d.content.length > MAX_TEXT ? d.content.slice(0, MAX_TEXT) + ' …' : d.content;
    const snippet = d.content.replace(/\s+/g, ' ').slice(0, 110);
    const description = `${d.document_type} of the Sangguniang Bayan of Sta. Cruz, Davao del Sur, dated ${fmtDate(d.created)}${d.author ? `, by ${d.author}` : ''}. ${snippet}`.slice(0, 300);

    const body = `${crumbs([['/', 'Home'], ['/documents/', 'Legislations'], ['/documents/archive/', 'Archive'], [`/documents/archive/${d.year}/`, String(d.year)], [monthPath, d.month], [null, d.title]])}
<article class="seo-card">
  <span class="type-pill">${esc(d.document_type)}</span>
  <h1 style="margin-top:10px;font-size:1.6rem;line-height:1.3">${esc(d.title)}</h1>
  <dl class="seo-meta">
    <dt>Type</dt><dd>${esc(d.document_type)}</dd>
    <dt>Date</dt><dd><time datetime="${d.created}">${fmtDate(d.created)}</time></dd>
    ${d.author ? `<dt>Author</dt><dd>${esc(d.author)}</dd>` : ''}
    <dt>Folder</dt><dd><a href="${monthPath}">${d.year} / ${d.month}</a></dd>
  </dl>
  <div class="seo-actions"><a class="portal-button" href="${esc(d.url)}" rel="noopener">Open PDF ↗</a>
  &nbsp; <a class="text-link" href="/documents/?year=${d.year}&amp;month=${d.month}">Search in this folder</a></div>
  ${text ? `<h2 style="font-size:1.05rem;margin-top:24px">Document text</h2><div class="seo-text">${esc(text)}</div>` : ''}
</article>`;

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Legislation',
      name: d.title,
      legislationType: d.document_type,
      legislationDate: d.created,
      datePublished: d.created,
      inLanguage: 'en-PH',
      author: d.author ? { '@type': 'Person', name: d.author } : undefined,
      publisher: { '@type': 'GovernmentOrganization', name: 'Sangguniang Bayan of Sta. Cruz, Davao del Sur' },
      url: site ? site + p : undefined,
      encoding: { '@type': 'MediaObject', contentUrl: d.url, encodingFormat: d.url.endsWith('.pdf') ? 'application/pdf' : undefined },
    };
    write(`${p.slice(1)}index.html`, page({ title: d.title, description, path: p, body, jsonLd }));
    urls.push([p, d.created]);
  }

  /* ── static archive hierarchy: years > months > documents ── */
  const byYear = new Map();
  for (const d of docs) {
    if (!byYear.has(d.year)) byYear.set(d.year, new Map());
    const months = byYear.get(d.year);
    if (!months.has(d.month_number)) months.set(d.month_number, []);
    months.get(d.month_number).push(d);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  write('documents/archive/index.html', page({
    title: 'Legislative Documents Archive',
    description: 'Archive of ordinances and resolutions of the Sangguniang Bayan of Sta. Cruz, Davao del Sur, by year and month.',
    path: '/documents/archive/',
    body: `${crumbs([['/', 'Home'], ['/documents/', 'Legislations'], [null, 'Archive']])}<h1>Legislative Documents Archive</h1>
<ul class="seo-list">${years.map((y) => `<li><a href="/documents/archive/${y}/">${y}</a><small>${[...byYear.get(y).values()].reduce((n, l) => n + l.length, 0)} documents</small></li>`).join('')}</ul>`,
  }));
  urls.push(['/documents/archive/', today]);

  for (const y of years) {
    const months = byYear.get(y);
    const nums = [...months.keys()].sort((a, b) => b - a);
    write(`documents/archive/${y}/index.html`, page({
      title: `Ordinances and Resolutions ${y}`,
      description: `Ordinances and resolutions of the Sangguniang Bayan of Sta. Cruz, Davao del Sur for ${y}, by month.`,
      path: `/documents/archive/${y}/`,
      body: `${crumbs([['/', 'Home'], ['/documents/', 'Legislations'], ['/documents/archive/', 'Archive'], [null, String(y)]])}<h1>${y}</h1>
<ul class="seo-list">${nums.map((n) => `<li><a href="/documents/archive/${y}/${String(n).padStart(2, '0')}/">${MONTHS[n - 1]} ${y}</a><small>${months.get(n).length} documents</small></li>`).join('')}</ul>`,
    }));
    urls.push([`/documents/archive/${y}/`, today]);

    for (const n of nums) {
      const list = months.get(n).sort((a, b) => (a.created < b.created ? 1 : -1));
      const mp = `/documents/archive/${y}/${String(n).padStart(2, '0')}/`;
      write(`${mp.slice(1)}index.html`, page({
        title: `${MONTHS[n - 1]} ${y} — Ordinances and Resolutions`,
        description: `${list.length} ordinances and resolutions of the Sangguniang Bayan of Sta. Cruz, Davao del Sur, ${MONTHS[n - 1]} ${y}.`,
        path: mp,
        body: `${crumbs([['/', 'Home'], ['/documents/', 'Legislations'], ['/documents/archive/', 'Archive'], [`/documents/archive/${y}/`, String(y)], [null, MONTHS[n - 1]]])}<h1>${MONTHS[n - 1]} ${y}</h1>
<ul class="seo-list">${list.map((d) => `<li><a href="${docPath(d)}">${esc(d.title)}</a><small>${esc(d.document_type)} · ${fmtDate(d.created)}${d.author ? ' · ' + esc(d.author) : ''}</small></li>`).join('')}</ul>`,
      }));
      urls.push([mp, today]);
    }
  }
}

/* ── sitemap + robots ── */
const staticUrls = [['/', today], ['/sb-members/', today], ['/documents/', today], ['/latest-updates/', today]];
try {
  const news = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'news.json'), 'utf-8')).items || [];
  for (const n of news.slice(0, 12)) staticUrls.push([`/latest-updates/${n.slug}/`, String(n.date_published).slice(0, 10)]);
} catch { /* no news */ }

const all = [...staticUrls, ...urls];
let robots = 'User-agent: *\nAllow: /\n';

if (site) {
  const CHUNK = 45000;
  const toXml = (list) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${list
      .map(([p, d]) => `<url><loc>${esc(site + p)}</loc><lastmod>${d}</lastmod></url>`).join('\n')}\n</urlset>\n`;

  if (all.length <= CHUNK) {
    write('sitemap.xml', toXml(all));
  } else {
    const files = [];
    for (let i = 0; i < all.length; i += CHUNK) {
      const name = `sitemap-${files.length + 1}.xml`;
      write(name, toXml(all.slice(i, i + CHUNK)));
      files.push(name);
    }
    write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.map((f) => `<sitemap><loc>${site}/${f}</loc><lastmod>${today}</lastmod></sitemap>`).join('\n')}\n</sitemapindex>\n`);
  }
  robots += `\nSitemap: ${site}/sitemap.xml\n`;
}
write('robots.txt', robots);
const countFiles = (dir) => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? countFiles(path.join(dir, e.name)) : 1), 0);
console.log(`[seo] documents from ${SEO_MIN_YEAR} (SEO_DOC_PAGES=${process.env.SEO_DOC_PAGES === 'true'}): ${isSample ? 0 : docs.length} pages (${allDocs.length - docs.length} older documents skipped), total files in out/: ${countFiles(OUT)} (free plan limit 20,000)`);
console.log(`[seo] ${all.length} sitemap URLs${site ? '' : ' (sitemap skipped)'}`);
