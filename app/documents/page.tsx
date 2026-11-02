import type { Metadata } from 'next';
import { DocumentsExplorer } from '../../components/DocumentsExplorer';
import { PageHero } from '../../components/PageHero';
import { getFolderTree } from '../../lib/data';

export const metadata: Metadata = { title: 'Legislative Documents' };

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
        </div>
      </section>
    </>
  );
}
