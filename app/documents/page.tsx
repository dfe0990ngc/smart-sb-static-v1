import type { Metadata } from 'next';
import { DocumentsExplorer } from '../../components/DocumentsExplorer';
import { PageHero } from '../../components/PageHero';
import { getFolderTree } from '../../lib/data';

export const metadata: Metadata = {
  title: 'Legislative Documents — Ordinances & Resolutions',
  description: 'Browse and search the ordinances and resolutions of the Sangguniang Bayan of Sta. Cruz, Davao del Sur by year and month.',
  alternates: { canonical: '/documents/' },
};

export default function DocumentsPage() {
  const tree = getFolderTree();

  return (
    <>
      <PageHero
        eyebrow="Public document records"
        title="Search ordinances and resolutions"
        description="Browse the archive by year and month, then search inside the folder you selected."
      />
      <section className="section-padding">
        <div className="container">
          <DocumentsExplorer tree={tree} />
          {process.env.SEO_DOC_PAGES === 'true' && (
            <p style={{ marginTop: 18, textAlign: 'center', fontSize: '0.9rem' }}>
              <a className="text-link" href="/documents/archive/">Browse the plain archive of documents by year and month →</a>
            </p>
          )}
        </div>
      </section>
    </>
  );
}
