const RICH_TEXT_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'ul', 'ol', 'li',
  'blockquote', 'h2', 'h3', 'h4', 'hr', 'span', 'div', 'img'
]);

const INLINE_TEXT_TAGS = new Set(['br', 'strong', 'b', 'em', 'i', 'u', 's', 'a', 'span']);
const URI_ATTRIBUTES = new Set(['href', 'src']);

function isSafeUrl(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized.startsWith('javascript:')) return false;
  if (normalized.startsWith('data:') && !normalized.startsWith('data:image/')) return false;
  return true;
}

function sanitizeAttributes(tag: string, attributes: string) {
  const allowedByTag: Record<string, Set<string>> = {
    a: new Set(['href', 'title', 'target', 'rel']),
    img: new Set(['src', 'alt', 'title', 'loading']),
    span: new Set(['title']),
    p: new Set(['title']),
    div: new Set(['title']),
    blockquote: new Set(['title']),
  };
  const allowed = allowedByTag[tag] || new Set<string>();
  const parts: string[] = [];
  const attrPattern = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*("[^"]*"|'[^']*'|[^\s"'>]+)/g;
  let match: RegExpExecArray | null;

  while ((match = attrPattern.exec(attributes)) !== null) {
    const name = match[1].toLowerCase();
    if (name.startsWith('on') || !allowed.has(name)) continue;

    const raw = match[2];
    const value = raw.replace(/^['"]|['"]$/g, '').trim();
    if (URI_ATTRIBUTES.has(name) && !isSafeUrl(value)) continue;

    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    parts.push(`${name}="${escaped}"`);
  }

  if (tag === 'a') {
    const hasTargetBlank = parts.some((part) => part === 'target="_blank"');
    const hasRel = parts.some((part) => part.startsWith('rel='));
    if (hasTargetBlank && !hasRel) parts.push('rel="noopener noreferrer"');
  }

  if (tag === 'img' && !parts.some((part) => part.startsWith('loading='))) {
    parts.push('loading="lazy"');
  }

  return parts.length ? ` ${parts.join(' ')}` : '';
}

function removeDangerousBlocks(html: string) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\s*(script|style|iframe|object|embed|svg|math|template)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*(script|style|iframe|object|embed|svg|math|template)[^>]*\/?>/gi, '');
}

export function sanitizeRichText(value?: string | null) {
  if (!value) return '';
  const cleaned = removeDangerousBlocks(value);

  return cleaned.replace(/<\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (match, rawTag, attributes) => {
    const tag = String(rawTag).toLowerCase();
    if (!RICH_TEXT_TAGS.has(tag)) return '';
    if (match.startsWith('</')) return `</${tag}>`;
    if (tag === 'br' || tag === 'hr') return `<${tag}>`;
    return `<${tag}${sanitizeAttributes(tag, attributes || '')}>`;
  });
}

export function sanitizeInlineHtml(value?: string | null) {
  if (!value) return '';
  const rich = sanitizeRichText(value);

  return rich.replace(/<\/?\s*([a-zA-Z0-9]+)([^>]*)>/g, (match, rawTag, attributes) => {
    const tag = String(rawTag).toLowerCase();
    if (!INLINE_TEXT_TAGS.has(tag)) {
      return tag === 'p' || tag === 'div' || /^h[1-6]$/.test(tag) ? ' ' : '';
    }
    if (match.startsWith('</')) return `</${tag}>`;
    if (tag === 'br') return '<br>';
    return `<${tag}${sanitizeAttributes(tag, attributes || '')}>`;
  }).replace(/\s{2,}/g, ' ').trim();
}
