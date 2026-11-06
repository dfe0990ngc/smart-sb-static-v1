import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();
export const CONTENT_DIR = path.join(ROOT, 'content');
export const DATA_DIR = path.join(ROOT, 'public', 'data');

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Loads content/documents.json (real export) or falls back to content/documents.sample.json */
export function loadDocuments() {
  const real = path.join(CONTENT_DIR, 'documents.json');
  const sample = path.join(CONTENT_DIR, 'documents.sample.json');
  const file = fs.existsSync(real) ? real : sample;
  const isSample = file === sample;
  if (isSample) console.warn('[data] content/documents.json not found - using documents.sample.json (run tools/paperless_export.py)');

  const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
  const list = Array.isArray(raw) ? raw : raw.documents;
  const docs = [];
  for (const d of list) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d.created || '');
    if (!d.id || !d.title || !m || !d.url) {
      console.warn(`[data] skipped invalid record id=${d.id}`);
      continue;
    }
    const year = Number(m[1]);
    const monthNumber = Number(m[2]);
    docs.push({
      ...d,
      created: `${m[1]}-${m[2]}-${m[3]}`,
      year,
      month_number: monthNumber,
      month: MONTHS[monthNumber - 1],
      document_type: d.document_type || 'Other',
      author: d.author || '',
      content: d.content || '',
    });
  }
  return { docs, isSample };
}

/* ───────── SEO helpers ───────── */
export function slugify(text) {
  return String(text || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 80).replace(/-+$/, '');
}

/** Crawlable page of a document, e.g. /documents/1042-ordinance-no-003-26-solid-waste/ */
export function docPath(d) {
  const slug = slugify(d.title);
  return `/documents/${d.id}${slug ? '-' + slug : ''}/`;
}

/** Absolute site URL (no trailing slash) from NEXT_PUBLIC_SITE_URL or .env.production; '' when not configured. */
export function getSiteUrl() {
  let url = process.env.NEXT_PUBLIC_SITE_URL || '';
  if (!url) {
    for (const f of ['.env.production.local', '.env.production', '.env.local', '.env']) {
      const file = path.join(ROOT, f);
      if (!fs.existsSync(file)) continue;
      const m = /^\s*NEXT_PUBLIC_SITE_URL\s*=\s*["']?([^"'\s#]+)/m.exec(fs.readFileSync(file, 'utf-8'));
      if (m) { url = m[1]; break; }
    }
  }
  url = url.trim().replace(/\/+$/, '');
  return /^https?:\/\/[^/]+\.[^/]+/i.test(url) && !/change-me/i.test(url) ? url : '';
}

/** Only documents from this year onward get their own crawlable page (keeps the deploy under the file limit). */
export const SEO_MIN_YEAR = Number(process.env.SEO_MIN_YEAR) || 2022;
/** Per-document pages are OFF unless SEO_DOC_PAGES=true (build variable). */
export const DOC_PAGES_ENABLED = process.env.SEO_DOC_PAGES === 'true';
export const hasPage = (d) => DOC_PAGES_ENABLED && d.year >= SEO_MIN_YEAR;
