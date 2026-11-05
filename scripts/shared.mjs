import fs from 'node:fs';
import path from 'node:path';

export const ROOT = process.cwd();
export const CONTENT_DIR = path.join(ROOT, 'content');
export const DATA_DIR = path.join(ROOT, 'public', 'data');

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// const ORDINANCE_PATTERN = /\b(?:municipal|appropriation)\s+ordinance\s+no\.?/i;

// const ORDINANCE_PATTERN = /^[ \t]*\\*{0,2}#?[ \t]*\\*{0,2}(?:municipal|appropriation)\s+ordinance\s+no\.?\s+\d+\\*{0,2}[ \t]*$/im;

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
    const content = d.content || '';
    docs.push({
      ...d,
      created: `${m[1]}-${m[2]}-${m[3]}`,
      year,
      month_number: monthNumber,
      month: MONTHS[monthNumber - 1],
      document_type: d.document_type || 'Other',
      author: d.author || '',
      content,
    });
  }
  return { docs, isSample };
}
