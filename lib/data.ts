import fs from 'node:fs';
import path from 'node:path';
import type { FolderTree, Manifest, Member, MembersFile, NewsFile, NewsItem } from './types';

const DATA_DIR = path.join(process.cwd(), 'public', 'data');

function readJson<T>(file: string, fallback: T): T {
  const full = path.join(DATA_DIR, file);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf-8')) as T;
  } catch (error) {
    console.warn(`[data] Could not read ${full}:`, (error as Error).message);
    return fallback;
  }
}

/* ───── Homepage ───── */
export function getManifest(): Manifest {
  const m = readJson<Partial<Manifest>>('manifest.json', {});
  return {
    generated_at: m.generated_at,
    stats: {
      ordinances: m.stats?.ordinances ?? 0,
      resolutions: m.stats?.resolutions ?? 0,
      sessions_conducted: m.stats?.sessions_conducted ?? 0,
      active_committees: m.stats?.active_committees,
    },
    latest_updates: (m.latest_updates ?? []).slice(0, 3),
  };
}

/* ───── News & Updates ───── */
export function getNews(limit = 12): NewsItem[] {
  const file = readJson<NewsFile>('news.json', { items: [] });
  return [...file.items]
    .sort((a, b) => +new Date(b.date_published) - +new Date(a.date_published))
    .slice(0, limit);
}

export function getNewsBySlug(slug: string): NewsItem | null {
  return getNews(12).find((item) => item.slug === slug) ?? null;
}

/* ───── Members ───── */
const FEATURED_RE = /\b(vice[\s-]?mayor|mayor)\b/i;

export function getMembers(): {
  featured: Member[];
  regular: Member[];
  groupPhoto: string;
  secretariatPhoto: string;
} {
  const file = readJson<MembersFile>('members.json', { members: [] });
  const sorted = [...file.members].sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));
  const isFeatured = (m: Member) => (m.featured !== undefined ? m.featured : FEATURED_RE.test(m.position));

  return {
    featured: sorted.filter(isFeatured),
    regular: sorted.filter((m) => !isFeatured(m)),
    groupPhoto: file.group_photo || '/images/sb-group.webp',
    secretariatPhoto: file.secretariat_group_photo || '/images/secretariat-group.webp',
  };
}

/* ───── Documents (folder tree only - records live in the Pagefind index) ───── */
export function getFolderTree(): FolderTree {
  return readJson<FolderTree>('documents-tree.json', { total: 0, types: [], years: [] });
}
