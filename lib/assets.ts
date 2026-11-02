/**
 * Resolve an image path coming from the JSON files.
 *  - "https://..."          -> used as-is (e.g. R2 / CDN)
 *  - "/images/members/a.webp" -> used as-is (deployed together with the pages)
 *  - "members/a.webp"       -> "/images/members/a.webp"
 */
export function assetUrl(value: string | null | undefined, fallback: string): string {
  const v = (value || '').trim();
  if (!v) return fallback;
  if (/^https?:\/\//i.test(v) || v.startsWith('/')) return v;
  return `/images/${v.replace(/^\.?\//, '')}`;
}
