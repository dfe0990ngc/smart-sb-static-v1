import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteImage from '../../../components/SiteImage';
import { formatDate } from '../../../components/UpdateCard';
import { getNews, getNewsBySlug } from '../../../lib/data';
import { sanitizeInlineHtml, sanitizeRichText } from '../../../lib/richText';

export const dynamicParams = false;

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return getNews(12).map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const update = getNewsBySlug(slug);
  return update ? { title: update.title.replace(/<[^>]+>/g, ''), description: update.excerpt.replace(/<[^>]+>/g, '') } : {};
}

export default async function LatestUpdateSinglePage({ params }: Props) {
  const { slug } = await params;
  const update = getNewsBySlug(slug);
  if (!update) notFound();

  return (
    <article className="article-page">
      <div className="container article-shell">
        <Link className="text-link" href="/latest-updates/">← Back to updates</Link>
        <SiteImage className="mi-auto" alt="Update cover" src={update.cover_photo} fallback="/images/update-records.svg" />
        <div className="meta-row-page">
          {update.category && <span>{update.category}</span>}
          <time dateTime={update.date_published}>{formatDate(update.date_published)}</time>
        </div>
        <h1 className="rich-title" dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(update.title) }} />
        <p className="lead-text" dangerouslySetInnerHTML={{ __html: sanitizeInlineHtml(update.excerpt) }} />
        <div className="article-content rich-text" dangerouslySetInnerHTML={{ __html: sanitizeRichText(update.content) }} />
      </div>
    </article>
  );
}
