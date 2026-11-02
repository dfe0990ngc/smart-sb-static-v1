'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { loadPagefind, safeExcerpt } from '../lib/pagefind';
import type { PagefindDoc, PagefindOptions, PagefindResult } from '../lib/pagefind';
import type { FolderTree, YearFolder } from '../lib/types';

const PAGE_SIZE = 15;

type SortMode = 'relevance' | 'newest' | 'oldest';
type Folder = { year?: number; month?: string };
type Meta = { title: string; author: string; created: string; year: string; month: string; type: string; file: string };
type Row = { id: string; meta: Meta; excerpt?: string };
type BrowseRecord = { id: number; title: string; author: string; created: string; month: string; type: string; url: string };

/* ───────── on-demand data caches ───────── */

// Browse mode (no search text): one small metadata file per year, fetched only when that page needs it.
const yearCache = new Map<number, Promise<BrowseRecord[]>>();
function loadYear(year: number): Promise<BrowseRecord[]> {
  let p = yearCache.get(year);
  if (!p) {
    p = fetch(`/data/docs/${year}.json`).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    });
    p.catch(() => yearCache.delete(year));
    yearCache.set(year, p);
  }
  return p;
}

// Search mode: Pagefind result fragments (contain the OCR text, so they are fetched per page, then cached).
const fragmentCache = new Map<string, Promise<PagefindDoc>>();
function loadFragment(r: PagefindResult): Promise<PagefindDoc> {
  let p = fragmentCache.get(r.id);
  if (!p) {
    p = r.data();
    p.catch(() => fragmentCache.delete(r.id));
    fragmentCache.set(r.id, p);
  }
  return p;
}

const toRow = (id: string, doc: PagefindDoc): Row => ({ id, meta: doc.meta as unknown as Meta, excerpt: doc.excerpt });

/* ───────── small helpers ───────── */

function Icon({ name }: { name: 'folder' | 'folder-open' | 'chevron' | 'search' | 'x' | 'file' | 'external' | 'calendar' | 'user' }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  switch (name) {
    case 'folder':
      return <svg {...common}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
    case 'folder-open':
      return <svg {...common}><path d="M6 14l1.5-2.9A2 2 0 0 1 9.2 10H20a2 2 0 0 1 1.9 2.6l-1.6 5.2a2 2 0 0 1-1.9 1.4H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.7.9L10.4 5H18a2 2 0 0 1 2 2v3" /></svg>;
    case 'chevron':
      return <svg {...common}><polyline points="9 6 15 12 9 18" /></svg>;
    case 'search':
      return <svg {...common}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>;
    case 'x':
      return <svg {...common}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>;
    case 'file':
      return <svg {...common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></svg>;
    case 'external':
      return <svg {...common}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>;
    case 'calendar':
      return <svg {...common}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>;
    case 'user':
      return <svg {...common}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
  }
}

function pageRange(current: number, total: number) {
  const range: (number | '…')[] = [];
  if (total <= 7) {
    for (let i = 1; i <= total; i++) range.push(i);
    return range;
  }
  range.push(1);
  if (current > 3) range.push('…');
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) range.push(i);
  if (current < total - 2) range.push('…');
  range.push(total);
  return range;
}

function formatDate(iso: string) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00+08:00`);
  if (Number.isNaN(+d)) return iso;
  return new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' }).format(d);
}

const countFor = (counts: { count: number; types: Record<string, number> }, type: string) =>
  type === 'All' ? counts.count : counts.types[type] ?? 0;

/* ───────── component ───────── */

export function DocumentsExplorer({ tree }: { tree: FolderTree }) {
  const [query, setQuery] = useState('');
  const [folder, setFolder] = useState<Folder>({});
  const [type, setType] = useState('All');
  const [sort, setSort] = useState<SortMode>('relevance');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [matchYears, setMatchYears] = useState<Record<string, number> | null>(null);
  const [matchMonths, setMatchMonths] = useState<Record<string, number> | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [hydrated, setHydrated] = useState(false);
  const [reload, setReload] = useState(0);

  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [panelOpen, setPanelOpen] = useState(false); // mobile
  const requestId = useRef(0);
  const searchCache = useRef<{ key: string; results: PagefindResult[]; years: Record<string, number>; months: Record<string, number> } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsTop = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const effectiveSort: SortMode = sort === 'relevance' && !trimmed ? 'newest' : sort;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const types = tree.types.length > 1 ? ['All', ...tree.types] : ['All'];

  /* ── restore state from the URL (shareable links) ── */
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const year = Number(p.get('year')) || undefined;
    const month = year ? p.get('month') || undefined : undefined;
    setQuery(p.get('q') || '');
    setFolder({ year, month });
    setType(p.get('type') || 'All');
    const s = p.get('sort') as SortMode | null;
    if (s === 'newest' || s === 'oldest' || s === 'relevance') setSort(s);
    setPage(Math.max(1, Number(p.get('page')) || 1));
    setExpanded(new Set(year ? [year] : tree.years.slice(0, 1).map((y) => y.year)));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── keep the URL in sync ── */
  useEffect(() => {
    if (!hydrated) return;
    const p = new URLSearchParams();
    if (trimmed) p.set('q', trimmed);
    if (folder.year) p.set('year', String(folder.year));
    if (folder.month) p.set('month', folder.month);
    if (type !== 'All') p.set('type', type);
    if (sort !== 'relevance') p.set('sort', sort);
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [hydrated, trimmed, folder, type, sort, page]);

  /* ── load records: instant browse from per-year JSON, or Pagefind when there is a query ── */
  useEffect(() => {
    if (!hydrated) return;
    const id = ++requestId.current;
    let cancelled = false;
    const stale = () => cancelled || id !== requestId.current;

    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;

    /* browse mode – counts come from the folder tree, only the needed year file(s) are fetched */
    const folderCount = (y: YearFolder) => {
      if (folder.year && y.year !== folder.year) return 0;
      if (folder.month) {
        const m = y.months.find((mm) => mm.month === folder.month);
        return m ? countFor(m, type) : 0;
      }
      return countFor(y, type);
    };
    const years = effectiveSort === 'oldest' ? [...tree.years].reverse() : tree.years;

    const browsePage = async (from: number, to: number): Promise<Row[]> => {
      const parts: Promise<BrowseRecord[]>[] = [];
      let offset = 0;
      for (const y of years) {
        const c = folderCount(y);
        if (!c) continue;
        const ys = offset;
        offset += c;
        if (offset <= from) continue;
        if (ys >= to) break;
        parts.push(
          loadYear(y.year).then((recs) => {
            let list = recs.filter((r) => (!folder.month || r.month === folder.month) && (type === 'All' || r.type === type));
            if (effectiveSort === 'oldest') list = list.reverse();
            return list.slice(Math.max(0, from - ys), to - ys).map((r) => ({ ...r, __year: y.year }));
          })
        );
      }
      const flat = (await Promise.all(parts)).flat() as (BrowseRecord & { __year: number })[];
      return flat.map((r) => ({
        id: String(r.id),
        meta: { title: r.title, author: r.author, created: r.created, year: String(r.__year), month: r.month, type: r.type, file: r.url },
      }));
    };

    setStatus('loading');

    (async () => {
      try {
        if (!trimmed) {
          const sum = years.reduce((n, y) => n + folderCount(y), 0);
          const slice = await browsePage(start, end);
          if (stale()) return;
          setRows(slice);
          setTotal(sum);
          setMatchYears(null);
          setMatchMonths(null);
          setStatus('ready');
          if (end < sum) browsePage(end, end + PAGE_SIZE).catch(() => {}); // warm the next page in the background
          return;
        }

        /* search mode – Pagefind is loaded on first use; results are kept so paging does not re-run the search */
        const filters: Record<string, string> = {};
        if (folder.year) filters.year = String(folder.year);
        if (folder.month) filters.month = folder.month;
        if (type !== 'All') filters.type = type;
        const options: PagefindOptions = { filters };
        if (effectiveSort !== 'relevance') options.sort = { created: effectiveSort === 'oldest' ? 'asc' : 'desc' };

        const key = JSON.stringify([trimmed, folder, type, effectiveSort]);
        let cached = searchCache.current;
        if (!cached || cached.key !== key) {
          const pf = await loadPagefind();
          const response = await pf.debouncedSearch(trimmed, options, 250);
          if (stale() || !response) return; // superseded by a newer keystroke
          cached = {
            key,
            results: response.results,
            years: response.totalFilters?.year ?? {},
            months: folder.year ? response.filters?.month ?? {} : {},
          };
          searchCache.current = cached;
        }

        const results = cached.results;
        const docs = await Promise.all(results.slice(start, end).map(async (r) => toRow(r.id, await loadFragment(r))));
        if (stale()) return;

        setRows(docs);
        setTotal(results.length);
        setMatchYears(cached.years);
        setMatchMonths(folder.year ? cached.months : null);
        setStatus('ready');

        // warm the next page's fragments in the background
        results.slice(end, end + PAGE_SIZE).forEach((r) => loadFragment(r).catch(() => {}));
      } catch (error) {
        if (stale()) return;
        console.error(error);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, trimmed, folder.year, folder.month, type, effectiveSort, page, reload]);

  /* ── "/" focuses the search box ── */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(el.tagName)) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ── actions ── */
  const selectFolder = useCallback((next: Folder) => {
    setFolder(next);
    setPage(1);
    setPanelOpen(false);
    if (next.year) setExpanded((prev) => new Set(prev).add(next.year as number));
  }, []);

  const toggleYear = (year: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(year) ? next.delete(year) : next.add(year);
      return next;
    });

  const goToPage = (n: number) => {
    setPage(Math.min(Math.max(1, n), totalPages));
    resultsTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ── derived ── */
  const scopeLabel = folder.year ? `${folder.year}${folder.month ? ` › ${folder.month}` : ''}` : 'All folders';
  const scoped = Boolean(folder.year);
  const allCount = useMemo(
    () => (type === 'All' ? tree.total : tree.years.reduce((n, y) => n + (y.types[type] ?? 0), 0)),
    [tree, type]
  );

  const yearBadge = (y: YearFolder) => {
    if (matchYears) return { value: matchYears[String(y.year)] ?? 0, match: true };
    return { value: countFor(y, type), match: false };
  };

  /* ───────── render ───────── */
  return (
    <div className="dx">
      {/* ── Folder panel ── */}
      <aside className="dx-folders" aria-label="Document folders">
        <button
          className="dx-folders-toggle"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          aria-controls="dx-folder-body"
        >
          <span><Icon name="folder-open" /> {scopeLabel}</span>
          <span className={`dx-chev${panelOpen ? ' open' : ''}`}><Icon name="chevron" /></span>
        </button>

        <div id="dx-folder-body" className={`dx-folders-body${panelOpen ? ' open' : ''}`}>
          <p className="dx-folders-title">Folders</p>
          <button
            className={`dx-row dx-row-all${!scoped ? ' active' : ''}`}
            onClick={() => selectFolder({})}
            aria-current={!scoped ? 'true' : undefined}
          >
            <span className="dx-row-label"><Icon name="folder" /> All folders</span>
            <span className="dx-count">{allCount}</span>
          </button>

          <ul className="dx-tree">
            {tree.years.map((y) => {
              const open = expanded.has(y.year);
              const badge = yearBadge(y);
              const yearActive = folder.year === y.year && !folder.month;
              return (
                <li key={y.year}>
                  <div className="dx-year">
                    <button
                      className="dx-twisty"
                      onClick={() => toggleYear(y.year)}
                      aria-expanded={open}
                      aria-label={`${open ? 'Collapse' : 'Expand'} ${y.year}`}
                    >
                      <span className={`dx-chev${open ? ' open' : ''}`}><Icon name="chevron" /></span>
                    </button>
                    <button
                      className={`dx-row${yearActive ? ' active' : ''}${badge.match && badge.value === 0 ? ' dim' : ''}`}
                      onClick={() => selectFolder({ year: y.year })}
                      aria-current={yearActive ? 'true' : undefined}
                    >
                      <span className="dx-row-label"><Icon name={folder.year === y.year ? 'folder-open' : 'folder'} /> {y.year}</span>
                      <span className={`dx-count${badge.match ? ' match' : ''}`}>{badge.value}</span>
                    </button>
                  </div>

                  {open && (
                    <ul className="dx-months">
                      {y.months.map((m) => {
                        const active = folder.year === y.year && folder.month === m.month;
                        const useMatch = matchMonths && folder.year === y.year;
                        const value = useMatch ? matchMonths![m.month] ?? 0 : countFor(m, type);
                        return (
                          <li key={m.month}>
                            <button
                              className={`dx-row dx-row-month${active ? ' active' : ''}${useMatch && value === 0 ? ' dim' : ''}`}
                              onClick={() => selectFolder({ year: y.year, month: m.month })}
                              aria-current={active ? 'true' : undefined}
                            >
                              <span className="dx-row-label">{m.month}</span>
                              <span className={`dx-count${useMatch ? ' match' : ''}`}>{value}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </aside>

      {/* ── Results ── */}
      <section className="dx-main" aria-busy={status === 'loading'}>
        <div className="dx-toolbar" ref={resultsTop}>
          <div className="dx-search">
            <Icon name="search" />
            <input
              ref={inputRef}
              type="search"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder={scoped ? `Search in ${scopeLabel}…` : 'Search title, author or content…'}
              aria-label="Search documents"
              onFocus={() => void loadPagefind().catch(() => {})}
              autoComplete="off"
              spellCheck={false}
            />
            {query ? (
              <button className="dx-clear" onClick={() => { setQuery(''); setPage(1); inputRef.current?.focus(); }} aria-label="Clear search">
                <Icon name="x" />
              </button>
            ) : (
              <kbd className="dx-kbd" aria-hidden="true">/</kbd>
            )}
          </div>

          <label className="dx-sort">
            {/* <span>Sort</span> */}
            <select value={sort} onChange={(e) => { setSort(e.target.value as SortMode); setPage(1); }}>
              <option value="relevance">{trimmed ? 'Best match' : 'Newest first (default)'}</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>

        {types.length > 1 && (
          <div className="dx-chips" role="group" aria-label="Document type">
            {types.map((t) => (
              <button
                key={t}
                className={`dx-chip${type === t ? ' active' : ''}`}
                onClick={() => { setType(t); setPage(1); }}
                aria-pressed={type === t}
              >
                {t === 'All' ? 'All types' : `${t}s`}
              </button>
            ))}
          </div>
        )}

        <div className="dx-summary" role="status" aria-live="polite">
          <span>
            {status === 'loading' && rows.length === 0 ? 'Loading records…' : (
              <>
                <strong>{total.toLocaleString('en-PH')}</strong> record{total === 1 ? '' : 's'}
                {trimmed && <> for “<em>{trimmed}</em>”</>}
                {totalPages > 1 && <> · page {page} of {totalPages}</>}
              </>
            )}
          </span>
          <span className="dx-scope">
            <Icon name="folder-open" /> {scopeLabel}
            {scoped && (
              <button className="dx-scope-reset" onClick={() => selectFolder({})}>Search all folders</button>
            )}
          </span>
        </div>

        <div className={`dx-results${status === 'loading' && rows.length > 0 ? ' refreshing' : ''}`}>
          {status === 'error' ? (
            <div className="empty-state error-state">
              <p>The search index could not be loaded.</p>
              <p style={{ marginTop: 6, fontSize: '0.82rem' }}>Please refresh the page or try again in a moment.</p>
              <button className="page-btn" onClick={() => { searchCache.current = null; setReload((n) => n + 1); }} style={{ marginTop: 14 }}>Retry</button>
            </div>
          ) : status === 'loading' && rows.length === 0 ? (
            <div className="records-skeleton" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div className="skeleton-row" key={i}>
                  <span className="skeleton-line wide" />
                  <span className="skeleton-line" />
                  <span className="skeleton-line short" />
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" />
              <p>No records match{trimmed ? <> “{trimmed}”</> : ' your filters'}{scoped ? <> in <strong>{scopeLabel}</strong></> : ''}.</p>
              <div className="dx-empty-actions">
                {trimmed && <button className="page-btn" onClick={() => setQuery('')}>Clear search</button>}
                {scoped && <button className="page-btn" onClick={() => selectFolder({})}>Search all folders</button>}
                {type !== 'All' && <button className="page-btn" onClick={() => { setType('All'); setPage(1); }}>All types</button>}
              </div>
            </div>
          ) : (
            <ol className="dx-list">
              {rows.map(({ id, meta: m, excerpt }) => {
                const file = m.file;
                return (
                  <li key={id} className="dx-card">
                    <div className="dx-card-icon" aria-hidden="true"><Icon name="file" /></div>
                    <div className="dx-card-main">
                      <div className="dx-card-meta">
                        {m.type && <span className="type-pill">{m.type}</span>}
                        {m.created && (
                          <span><Icon name="calendar" /> <time dateTime={m.created}>{formatDate(m.created)}</time></span>
                        )}
                        <span className="dx-path"><Icon name="folder" /> {m.year}{m.month ? ` / ${m.month}` : ''}</span>
                      </div>
                      <h3 className="dx-card-title">
                        <a href={file} target="_blank" rel="noopener noreferrer">{m.title}</a>
                      </h3>
                      {m.author && <p className="dx-card-author"><Icon name="user" /> {m.author}</p>}
                      {trimmed && excerpt && (
                        <p className="dx-excerpt" dangerouslySetInnerHTML={{ __html: safeExcerpt(excerpt) }} />
                      )}
                    </div>
                    <a className="dx-open" href={file} target="_blank" rel="noopener noreferrer" aria-label={`Open ${m.title}`}>
                      Open <Icon name="external" />
                    </a>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {totalPages > 1 && status !== 'error' && (
          <nav className="pagination" aria-label="Pagination">
            <button className="page-btn" onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label="Previous page">‹</button>
            {pageRange(page, totalPages).map((item, i) =>
              item === '…' ? (
                <span key={`e${i}`} className="page-info">…</span>
              ) : (
                <button
                  key={item}
                  className={`page-btn${page === item ? ' active' : ''}`}
                  onClick={() => goToPage(item)}
                  aria-label={`Page ${item}`}
                  aria-current={page === item ? 'page' : undefined}
                >
                  {item}
                </button>
              )
            )}
            <button className="page-btn" onClick={() => goToPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">›</button>
          </nav>
        )}
      </section>
    </div>
  );
}
