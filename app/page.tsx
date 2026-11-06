import type { Metadata } from 'next';
import Link from 'next/link';
import { UpdateCard } from '../components/UpdateCard';
import { MANAGEMENT_PORTAL_URL, SITE_URL } from '../lib/config';
import { getManifest } from '../lib/data';

export const metadata: Metadata = {
  title: { absolute: 'SMART-SB — Sangguniang Bayan of Sta. Cruz, Davao del Sur' },
  description:
    'Official public portal of the Sangguniang Bayan of Sta. Cruz, Davao del Sur: search ordinances and resolutions, meet the members, and read the latest updates.',
  alternates: { canonical: '/' },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'GovernmentOrganization',
      name: 'Sangguniang Bayan of Sta. Cruz, Davao del Sur',
      alternateName: 'SMART-SB',
      url: SITE_URL || undefined,
      logo: SITE_URL ? `${SITE_URL}/images/logo.png` : undefined,
      address: { '@type': 'PostalAddress', addressLocality: 'Sta. Cruz', addressRegion: 'Davao del Sur', addressCountry: 'PH' },
    },
    { '@type': 'WebSite', name: 'SMART-SB Public Portal', url: SITE_URL || undefined, inLanguage: 'en-PH' },
  ],
};

const primaryFeatures = [
  {
    icon: '/images/icons/gavel-blue.svg',
    title: 'Ordinances',
    description: 'Track and access all locally enacted ordinances and legislative measures.',
  },
  {
    icon: '/images/icons/file-blue.svg',
    title: 'Resolutions',
    description: 'Browse resolutions adopted by the Sangguniang Bayan.',
  },
  {
    icon: '/images/icons/calendar-blue.svg',
    title: 'Sessions',
    description: 'View session schedules, agendas, minutes, and recorded proceedings.',
  },
  {
    icon: '/images/icons/chat-blue.svg',
    title: 'Public Forum',
    description: 'Engage with local governance and participate in public consultations.',
  },
];

const legislativeRecordBenefits = [
  'Searchable record archive',
  'Real-time session updates',
  'Public document downloads',
];

const governanceBenefits = [
  'Automated legislative workflows',
  'Public access to records and updates',
  'Data-driven insights and reporting',
];

const governanceFeatures = [
  {
    icon: '/images/icons/edit-blue.svg',
    title: 'Legislative Drafting',
    description: 'Tools for drafting and managing legislative documents.',
  },
  {
    icon: '/images/icons/globe-blue.svg',
    title: 'Council Portal',
    description: 'Secure access to records and staff tools.',
  },
  {
    icon: '/images/icons/stat-blue.svg',
    title: 'Analytics',
    description: 'Legislative performance metrics and reporting.',
  },
];

export default function HomePage() {
  const { stats, latest_updates: updates } = getManifest();
  const managementPortalUrl = MANAGEMENT_PORTAL_URL;

  const statCards = [
    { icon: '/images/icons/gavel.svg', value: stats.ordinances, label: 'Enacted Ordinances' },
    { icon: '/images/icons/file.svg', value: stats.resolutions, label: 'Resolutions' },
    { icon: '/images/icons/calendar.svg', value: stats.sessions_conducted, label: 'Sessions Conducted' },
    ...(typeof stats.active_committees === 'number'
      ? [{ icon: '/images/icons/people.svg', value: stats.active_committees, label: 'Active Committees' }]
      : []),
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="hero-section">
        <div className="hero-section-overlay" aria-hidden="true" />
        <div className="container">
          <div className="hero-texts">
            <img src="/images/smart-sb.png" alt="SMART-SB" className="dashboard-hero-image" />
            <h1>Building a <strong style={{fontWeight: 900}}>SMARTER</strong></h1>
            <h2>Sangguniang Bayan</h2>
            <p>
              SMART-SB is the official digital platform of the Sangguniang Bayan of Sta. Cruz,
              Davao del Sur — providing transparent, efficient, and accessible legislative
              services for everyone.
            </p>
            <div className="hero-actions">
              {/* <a className="primary-action" href={managementPortalUrl} target="_blank" rel="noreferrer">
                Management Portal ↪
              </a> */}
              <Link className="secondary-action" href="/documents/">
                Browse Legislations 🗁
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-image-banner" aria-hidden="true">
        <div className="hero-section-overlay-bottom" />
      </section>

      <section className="section-padding muted-section" aria-label="Legislative statistics">
        <div className="container stats-cards">
          {statCards.map((stat) => (
            <article className="stats-cards-item" key={stat.label}>
              <img src={stat.icon} className="icon-wrapper icon" alt="" aria-hidden="true" />
              <div>
                <strong>
                  {stat.value.toLocaleString('en-PH')}
                  <span className="text-primary">+</span>
                </strong>
                <p>{stat.label}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section-padding feature-section">
        <div className="container">
          <div className="section-heading">
            <h2>
              Legislative Management &amp; <span className="text-primary">Public Information System</span>
            </h2>
            <p>
              Manage legislative records, sessions, and public information with efficiency and transparency.
              SMART-SB brings legislative processes into one accessible digital platform.
            </p>
          </div>

          <div className="feature-grid">
            {primaryFeatures.map((feature) => (
              <article className="feature-card" key={feature.title}>
                <span>
                  <img src={feature.icon} className="icon-wrapper icon" alt="" aria-hidden="true" />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section-padding muted-section">
        <div className="container section-heading">
          <div className="feature-grid-2">
            <article className="feature-card">
              <span>
                <img src="/images/icons/book-open-blue.svg" className="icon-wrapper icon" alt="" aria-hidden="true" />
              </span>
              <h3>Access Legislative Records</h3>
              <p>
                Browse the archive of ordinances, resolutions, and public legislative documents of the
                Sangguniang Bayan of Sta. Cruz, Davao del Sur.
              </p>
              <ul className="text-muted check-list lh-1">
                {legislativeRecordBenefits.map((benefit) => (
                  <li key={benefit}>
                    <img src="/images/icons/check-circle-blue.svg" alt="" aria-hidden="true" />
                    {benefit}
                  </li>
                ))}
              </ul>
              <Link className="section-inline-link text-primary" href="/documents/">
                View Legislative Records
              </Link>
            </article>

            <article>
              <div className="split-heading-2">
                <h3>Latest Updates</h3>
                {updates.length > 0 && <Link className="text-link" href="/latest-updates/">
                  View all →
                </Link>}
              </div>
              <div className="updates-grid">
                {updates.length > 0 ? (
                  updates.map((update) => <UpdateCard key={update.slug} update={update} variant="compact" />)
                ) : (
                  <p className="empty-copy">No updates available at the moment.</p>
                )}
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="section-padding">
        <div className="container section-heading">
          <div className="feature-grid-2">
            <img src="/images/footer-digital-govt.png" alt="Digital legislative governance" className="feature-image" />
            <article>
              <h3>
                Digital Governance for <span className="text-primary">Transparency and Efficiency</span>
              </h3>
              <ul className="text-muted check-list lh-1">
                {governanceBenefits.map((benefit) => (
                  <li key={benefit}>
                    <img src="/images/icons/check-circle-blue.svg" alt="" aria-hidden="true" />
                    {benefit}
                  </li>
                ))}
              </ul>

              <div className="feature-grid-3 mt-32">
                {governanceFeatures.map((feature) => (
                  <article className="feature-card" key={feature.title}>
                    <span>
                      <img src={feature.icon} className="icon-wrapper icon" alt="" aria-hidden="true" />
                    </span>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </article>
                ))}
              </div>

              <Link className="primary-action compact-action" href="/documents/">
                Learn More ↪
              </Link>
            </article>
          </div>
        </div>
      </section>

      {/* <section className="section-call-to-action-bg section-padding">
        <div className="container section-heading split-heading">
          <article className="feature-card-footer">
            <span>
              <img src="/images/icons/person-footer-accent.svg" className="icon-wrapper icon" alt="" aria-hidden="true" />
            </span>
            <h3>Access. Manage. Serve.</h3>
            <p>A smarter way to build a transparent and efficient Sangguniang Bayan.</p>
          </article>
          <a className="tertiary-action" href={managementPortalUrl} target="_blank" rel="noreferrer">
            Management Portal ↪
          </a>
        </div>
      </section> */}
    </>
  );
}
