/* ───────── Homepage manifest  (public/data/manifest.json) ───────── */
export type NewsSummary = {
  slug: string;
  title: string;
  excerpt: string;
  cover_photo: string | null;
  date_published: string;
};

export type Manifest = {
  generated_at?: string;
  stats: {
    ordinances: number;
    resolutions: number;
    sessions_conducted: number;
    active_committees?: number; // optional 4th card
  };
  latest_updates: NewsSummary[];
};

/* ───────── News & updates  (public/data/news.json) ───────── */
export type NewsItem = NewsSummary & {
  id: number | string;
  category?: string;
  content?: string; // HTML
};

export type NewsFile = { generated_at?: string; items: NewsItem[] };

/* ───────── Members  (public/data/members.json) ───────── */
export type Member = {
  name: string;
  position: string;
  photo?: string | null;
  sort: number;
  featured?: boolean;
};

export type MembersFile = {
  updated_at?: string;
  group_photo?: string;
  secretariat_group_photo?: string;
  members: Member[];
};

/* ───────── Documents folder tree  (public/data/documents-tree.json) ───────── */
export type TypeCounts = Record<string, number>;

export type MonthFolder = { month: string; number: number; count: number; types: TypeCounts };
export type YearFolder = { year: number; count: number; types: TypeCounts; months: MonthFolder[] };

export type FolderTree = {
  generated_at?: string;
  total: number;
  types: string[];
  years: YearFolder[];
};

/* ───────── Documents source  (content/documents.json, build-time only) ───────── */
export type SourceDocument = {
  id: number;
  title: string;
  content: string;
  author: string | null;
  created: string; // YYYY-MM-DD
  year: number;
  month: string;
  month_number: number;
  document_type: string | null;
  file_key: string;
  url: string;
};
