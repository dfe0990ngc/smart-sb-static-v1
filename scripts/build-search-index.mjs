/**
 * Builds the Pagefind index straight from content/documents.json (no HTML pages needed).
 * Usage: node scripts/build-search-index.mjs <output-dir>      e.g. out/pagefind  |  public/pagefind (dev)
 *
 * Filters  : year, month, type   -> folder-scoped search + type chips
 * Sort     : created (YYYY-MM-DD)
 * Meta     : title, author, created, year, month, type, file (R2 url)
 */
import fs from 'node:fs';
import path from 'node:path';
import * as pagefind from 'pagefind';
import { loadDocuments } from './shared.mjs';

const outputPath = path.resolve(process.argv[2] || 'out/pagefind');
const { docs } = loadDocuments();

if (docs.length === 0) {
  console.warn('[pagefind] no documents - index not created');
  process.exit(0);
}

fs.rmSync(outputPath, { recursive: true, force: true });

const { index, errors } = await pagefind.createIndex({ forceLanguage: 'en' });
if (!index) {
  console.error('[pagefind] createIndex failed', errors);
  process.exit(1);
}

let added = 0;
for (const d of docs) {
  const body = [d.title, d.author, d.content].filter(Boolean).join('\n');
  const { errors: addErrors } = await index.addCustomRecord({
    url: `/documents/#doc-${d.id}`,
    content: body,
    language: 'en',
    meta: {
      title: d.title,
      author: d.author || '',
      created: d.created,
      year: String(d.year),
      month: d.month,
      type: d.document_type,
      file: d.url,
    },
    filters: { year: [String(d.year)], month: [d.month], type: [d.document_type] },
    sort: { created: d.created },
  });
  if (addErrors?.length) console.warn(`[pagefind] doc ${d.id}:`, addErrors);
  else added++;
}

const { errors: writeErrors } = await index.writeFiles({ outputPath });
if (writeErrors?.length) {
  console.error('[pagefind] writeFiles failed', writeErrors);
  process.exit(1);
}
await pagefind.close();
console.log(`[pagefind] indexed ${added}/${docs.length} documents -> ${path.relative(process.cwd(), outputPath)}`);
