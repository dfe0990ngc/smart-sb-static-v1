/* Minimal typings + loader for the Pagefind client that is generated at build time into /pagefind/ */

export type PagefindDoc = {
  url: string;
  excerpt: string;
  content: string;
  meta: Record<string, string>;
  filters: Record<string, string[]>;
};

export type PagefindResult = { id: string; score: number; data: () => Promise<PagefindDoc> };

export type PagefindSearch = {
  results: PagefindResult[];
  unfilteredResultCount: number;
  /** counts per filter value, as if the filter itself was not selected (facet counts) */
  filters: Record<string, Record<string, number>>;
  /** counts per filter value for the search term only (ignores every selected filter) */
  totalFilters: Record<string, Record<string, number>>;
};

export type PagefindOptions = {
  filters?: Record<string, string>;
  sort?: Record<string, 'asc' | 'desc'>;
};

export type PagefindApi = {
  init: () => Promise<void>;
  filters: () => Promise<Record<string, Record<string, number>>>;
  search: (term: string | null, options?: PagefindOptions) => Promise<PagefindSearch>;
  debouncedSearch: (term: string | null, options?: PagefindOptions, ms?: number) => Promise<PagefindSearch | null>;
};

let cached: Promise<PagefindApi> | null = null;

export function loadPagefind(): Promise<PagefindApi> {
  if (!cached) {
    // Variable + webpackIgnore => the bundler leaves this as a real browser import of /pagefind/pagefind.js
    const url = '/pagefind/pagefind.js';
    cached = import(/* webpackIgnore: true */ url).then(async (mod: PagefindApi) => {
      await mod.init();
      await mod.filters(); // preload every filter index so facet counts (year/month/type) are always returned
      return mod;
    });
    cached.catch(() => (cached = null)); // allow retry
  }
  return cached;
}

/** Keep only <mark> tags from a Pagefind excerpt; everything else is stripped / escaped. */
export function safeExcerpt(html: string): string {
  return html
    .replace(/<(?!\/?mark>)[^>]*>/gi, '')
    .replace(/<(?!\/?mark>)/gi, '&lt;');
}
