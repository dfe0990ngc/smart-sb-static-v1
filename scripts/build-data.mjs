/**
 * Pre-build step:
 *  1. content/documents.json  -> public/data/documents-tree.json   (year/month folder counts)
 *  2. refreshes public/data/manifest.json:
 *       stats.ordinances / stats.resolutions   (counted from the documents export)
 *       latest_updates                         (top 3 of public/data/news.json)
 *     stats.sessions_conducted (and optional stats.active_committees) are yours to edit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, loadDocuments } from './shared.mjs';

fs.mkdirSync(DATA_DIR, { recursive: true });
const readJson = (f, fb) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8')); } catch { return fb; }
};
const writeJson = (f, v) => fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(v, null, 2) + '\n');

/* ── folder tree ── */
const { docs, isSample } = loadDocuments();
const bump = (obj, key) => { obj[key] = (obj[key] || 0) + 1; };

const years = new Map();
const typeTotals = {};
for (const d of docs) {
  bump(typeTotals, d.document_type);
  if (!years.has(d.year)) years.set(d.year, { year: d.year, count: 0, types: {}, months: new Map() });
  const y = years.get(d.year);
  y.count++; bump(y.types, d.document_type);
  if (!y.months.has(d.month_number)) y.months.set(d.month_number, { month: d.month, number: d.month_number, count: 0, types: {} });
  const m = y.months.get(d.month_number);
  m.count++; bump(m.types, d.document_type);
}

const preferred = ['Ordinance', 'Resolution'];
const types = Object.keys(typeTotals).sort((a, b) => {
  const ia = preferred.indexOf(a), ib = preferred.indexOf(b);
  return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
});

const tree = {
  generated_at: new Date().toISOString(),
  total: docs.length,
  types,
  years: [...years.values()]
    .sort((a, b) => b.year - a.year)
    .map((y) => ({ ...y, months: [...y.months.values()].sort((a, b) => b.number - a.number) })),
};
writeJson('documents-tree.json', tree);
console.log(`[data] documents-tree.json  ${docs.length} documents, ${tree.years.length} year folders${isSample ? ' (SAMPLE)' : ''}`);

/* ── manifest ── */
const manifest = readJson('manifest.json', {});
manifest.stats = manifest.stats || { ordinances: 0, resolutions: 0, sessions_conducted: 0 };

if (!isSample) {
  const countLike = (re) => Object.entries(typeTotals).filter(([k]) => re.test(k)).reduce((n, [, v]) => n + v, 0);
  manifest.stats.ordinances = countLike(/ordinance/i);
  manifest.stats.resolutions = countLike(/resolution/i);
}

const news = readJson('news.json', { items: [] }).items || [];
manifest.latest_updates = [...news]
  .sort((a, b) => +new Date(b.date_published) - +new Date(a.date_published))
  .slice(0, 3)
  .map(({ slug, title, excerpt, cover_photo, date_published }) => ({ slug, title, excerpt, cover_photo, date_published }));

manifest.generated_at = new Date().toISOString();
writeJson('manifest.json', manifest);
console.log(`[data] manifest.json        ordinances=${manifest.stats.ordinances} resolutions=${manifest.stats.resolutions} sessions=${manifest.stats.sessions_conducted} latest=${manifest.latest_updates.length}`);
