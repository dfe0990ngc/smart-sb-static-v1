import type { Metadata } from 'next';
import { PageHero } from '../../components/PageHero';
import { PersonCard } from '../../components/PersonCard';
import SiteImage from '../../components/SiteImage';
import { getMembers } from '../../lib/data';

export const metadata: Metadata = { title: 'Sangguniang Bayan Members' };

export default function SBMembersPage() {
  const { featured, regular, groupPhoto, secretariatPhoto } = getMembers();

  return (
    <>
      <PageHero
        eyebrow="Organizational Structure"
        title="Sangguniang Bayan Members"
        description="Meet the presiding officer and current members of the Sangguniang Bayan of Sta. Cruz, Davao del Sur."
      />

      <section className="section-padding">
        <div className="group-photo-card container">
          <SiteImage src={groupPhoto} fallback="/images/sb-group-default.svg" alt="Sangguniang Bayan members" />
          <div>
            <span className="eyebrow">Members Group Photo</span>
            <h2>Official SB Members</h2>
            <p>
              These are the elected leaders of the Sangguniang Bayan of Santa Cruz — dedicated public servants
              working together to craft ordinances, pass resolutions, and advance the welfare of every constituent
              in our municipality. Guided by transparency, accountability, and genuine commitment to community,
              they represent the voice of the people in local legislation.
            </p>
          </div>
        </div>
      </section>

      <section className="section-padding muted-section">
        <div className="container org-stack">
          {featured.map((person) => (
            <PersonCard key={person.name} person={person} featured />
          ))}
          {regular.length > 0 && (
            <>
              <div className="section-heading centered-heading">
                <h2>Regular Members</h2>
              </div>
              <div className="people-grid">
                {regular.map((person) => (
                  <PersonCard key={person.name} person={person} />
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <section className="section-padding">
        <div className="group-photo-card-rev container">
          <div>
            <span className="eyebrow">Secretariat Group Photo</span>
            <h2>Secretariat Team</h2>
            <p>
              The dedicated staff of the Sangguniang Bayan Secretariat provides essential administrative and
              technical support to the legislative body of Santa Cruz. From maintaining official records and
              preparing session documents to coordinating committee activities, the secretariat team ensures that
              every legislative process runs smoothly, accurately, and with the highest standard of public service.
            </p>
          </div>
          <SiteImage
            src={secretariatPhoto}
            fallback="/images/secretariat-group-default.svg"
            alt="Sangguniang Bayan Secretariat team"
          />
        </div>
      </section>
    </>
  );
}
