import Link from 'next/link';
import type { NewsItem, NewsSummary } from '../lib/types';
import { sanitizeInlineHtml } from '../lib/richText';
import SiteImage from './SiteImage';

type UpdateCardProps = {
  update: NewsSummary & Partial<NewsItem>;
  variant?: 'default' | 'compact';
};

export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Manila',
  }).format(new Date(date));
}

export function UpdateCard({ update, variant = 'default' }: UpdateCardProps) {
  const href = `/latest-updates/${update.slug}/`;
  const formattedDate = formatDate(update.date_published);

  if (variant === 'compact') {
    return (
      <article className="update-card">
        <SiteImage alt="" src={update.cover_photo} fallback="/images/update-records.svg" />
        <div className="update-card-body">
          <Link className="update-card-title" href={href}>
            <h3 dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(update.title) }} />
          </Link>
          <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(update.excerpt) }} />
          <time className="update-card-date" dateTime={update.date_published}>
            🕝 {formattedDate}
          </time>
        </div>
      </article>
    );
  }

  return (
    <article className="update-card-page">
      <SiteImage alt="" src={update.cover_photo} fallback="/images/update-records.svg" />
      <div className="update-card-body-page">
        <div className="meta-row-page">
          {update.category && <span>{update.category}</span>}
          <time dateTime={update.date_published}>{formattedDate}</time>
        </div>
        <h3 dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(update.title) }} />
        <p dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(update.excerpt) }} />
        <Link href={href}>Read update</Link>
      </div>
    </article>
  );
}
