# SMART-SB Public Portal — static build for Cloudflare Pages

Next.js static export (`out/`) + Pagefind search. No server, no database, no Directus at runtime.

```
Paperless-ngx ──tools/paperless_export.py──▶ content/documents.json ─┐
              └─tools/paperless_to_r2.py──▶ R2 bucket smart-sb-storage │   npm run build
                                                                       ├──────────────▶ out/  ──▶ Cloudflare Pages
public/data/manifest.json  members.json  news.json  (+ public/images) ─┘
```

## Pages

| Route | Data source |
|---|---|
| `/` | `public/data/manifest.json` |
| `/sb-members/` | `public/data/members.json` + photos in `public/images/members/` |
| `/documents/` | folder tree `public/data/documents-tree.json` + Pagefind index (both built from `content/documents.json`) |
| `/latest-updates/` (+ detail pages) | `public/data/news.json` (top 12) |

## 1. Documents: Paperless-ngx → JSON + R2

```bash
cd tools && python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # fill in Paperless token, R2 keys, R2_PUBLIC_BASE_URL
cd ..

python tools/paperless_export.py           # -> content/documents.json
python tools/paperless_to_r2.py --dry-run  # shows what is missing in the bucket
python tools/paperless_to_r2.py            # uploads only keys that do not exist yet
```

* Extracted: `title`, `content`, author (custom field `document_author`, name or id via `PAPERLESS_AUTHOR_FIELD`), `created`, and a generated R2 link.
* R2 key / link: `documents/<year>/<MM>/<paperless-id>.<ext>` → `${R2_PUBLIC_BASE_URL}/documents/2025/03/1042.pdf`.
  The bucket needs public access (custom domain or r2.dev) for these links to open.
* `PUBLIC_DOCUMENT_TYPES=Ordinance,Resolution` limits the export (empty = everything).
* Year/month folders come from the `created` date.

## 2. Other JSON files

`public/data/*.json` already contain sample content — replace with yours.

**manifest.json** (homepage). `ordinances`, `resolutions` and `latest_updates` are refreshed on every build
(counts from the documents export, latest 3 from `news.json`); you maintain `sessions_conducted`.
```json
{
  "generated_at": "2026-11-02T00:00:00Z",
  "stats": { "ordinances": 124, "resolutions": 310, "sessions_conducted": 96 },
  "latest_updates": [
    { "slug": "regular-session-schedule", "title": "…", "excerpt": "…",
      "cover_photo": "/images/news/session.webp", "date_published": "2026-10-28T08:00:00+08:00" }
  ]
}
```
(`stats.active_committees` is optional – adds a 4th card.)

**members.json**
```json
{
  "updated_at": "2026-11-02",
  "group_photo": "/images/sb-group.webp",
  "secretariat_group_photo": "/images/secretariat-group.webp",
  "members": [
    { "name": "Hon. Juan Dela Cruz", "position": "Municipal Vice Mayor / Presiding Officer", "photo": "/images/members/vice-mayor.webp", "sort": 1, "featured": true },
    { "name": "Hon. Maria Santos",   "position": "Municipal Councilor", "photo": "/images/members/santos.webp", "sort": 10 }
  ]
}
```
`featured` is optional; if omitted, positions containing “Mayor”/“Vice Mayor” are shown as the large cards.
Photos are normal files in `public/images/members/` and ship with the pages. A missing photo falls back to a placeholder.

**news.json** (page shows the newest 12; each gets a detail page)
```json
{
  "generated_at": "2026-11-02T00:00:00Z",
  "items": [
    { "id": 1, "slug": "regular-session-schedule", "title": "…", "excerpt": "…", "category": "Announcement",
      "cover_photo": "/images/news/session.webp", "date_published": "2026-10-28T08:00:00+08:00",
      "content": "<p>HTML body</p>" }
  ]
}
```
`cover_photo` can be a site path (`/images/news/…`) or a full URL (e.g. an R2 image).

## 3. Build & deploy

```bash
npm install
npm run dev        # local dev (builds data + search index first)
npm run build      # data -> next build -> pagefind index  => out/
npm run preview    # wrangler pages dev out
npm run deploy     # build + wrangler pages deploy out --project-name smart-sb
```

Recommended: build where Paperless is reachable and use **direct upload** (`npm run deploy`, run `npx wrangler login` once).
If you use Cloudflare’s Git integration instead, commit `content/documents.json` (remove it from `.gitignore`);
build command `npm run build`, output directory `out`, Node 20+.

Optional env (Pages → Settings → Environment variables, or `.env.local`): `NEXT_PUBLIC_MANAGEMENT_PORTAL_URL`.

## Documents search

* Folder tree (All folders → year → month) with counts; selecting a folder **scopes the search** (Pagefind filters `year` / `month`).
* While a query is active the tree shows match counts per year (and per month inside the selected year).
* Type chips (Ordinances / Resolutions), sort (best match / newest / oldest), highlighted excerpts, numbered pagination,
  shareable URLs (`?q=…&year=2025&month=March&type=Ordinance&page=2`), `/` focuses the search box, mobile folder drawer.
* The index is created from the JSON with Pagefind’s Node API (`scripts/build-search-index.mjs`) – no HTML per document.

## Notes

* Removed from the old project: Directus client, `/api/*` routes, `next-pwa` service worker (it would cache stale JSON; `manifest.webmanifest` is kept), `/secretariat`.
* Pagefind writes roughly one fragment file per document. Cloudflare Pages limits files per deployment
  (20,000 on the free plan when last checked) — check the current limit if the archive grows past ~15k documents.
