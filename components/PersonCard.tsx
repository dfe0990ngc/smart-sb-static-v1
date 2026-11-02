import type { Member } from '../lib/types';
import SiteImage from './SiteImage';

type PersonCardProps = {
  person: Member;
  featured?: boolean;
};

export function PersonCard({ person, featured = false }: PersonCardProps) {
  return (
    <article className={featured ? 'person-card person-card-featured' : 'person-card'}>
      <SiteImage
        alt={`Photo of ${person.name}`}
        src={person.photo}
        fallback="/images/profiles/member-1.svg"
      />
      <div>
        <h3>{person.name}</h3>
        <span className="person-tier">{person.position}</span>
      </div>
    </article>
  );
}
