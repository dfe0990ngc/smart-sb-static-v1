import type { Metadata } from 'next';
import { PageHero } from '../../components/PageHero';
import { UpdateCard } from '../../components/UpdateCard';
import { getNews } from '../../lib/data';

export const metadata: Metadata = { title: 'News & Updates' };

export default function LatestUpdatesPage() {
  const updates = getNews(12);

  return (
    <>
      <PageHero
        eyebrow="Announcements and events"
        title="News & Updates"
        description="Read the latest public announcements, events, schedules, and legislative updates from the Sangguniang Bayan."
      />
      <section className="section-padding muted-section latest-updates-section">
        <div className="updates-grid-page container">
          {updates.length > 0 ? (
            updates.map((update) => <UpdateCard key={update.slug} update={update} />)
          ) : (
            <p className="empty-copy">No updates are available at the moment.</p>
          )}
        </div>
      </section>
    </>
  );
}
