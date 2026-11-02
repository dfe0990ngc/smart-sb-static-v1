import Link from 'next/link';
import { MANAGEMENT_PORTAL_URL } from '../lib/config';

const links = [
  { href: '/', label: 'Home' },
  { href: '/sb-members/', label: 'Members' },
  { href: '/documents/', label: 'Legislations' },
  { href: '/latest-updates/', label: 'News & Updates' },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="footer-brand">
              <img src="/images/logo.png" alt="SMART-SB Logo" className="footer-brand-image" />
              <strong>SMART-SB</strong>
            </div>
            <p>
              Streamlined, Modernized, Accessible, Records for Transparency <span>Sangguniang Bayan</span> —
              making legislative records easier for every citizen to find.
            </p>
            <p className="footer-meta">Santa Cruz Municipal Government</p>
          </div>
          <div className="footer-col">
            <h4>Navigation</h4>
            {links.map((l) => (
              <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
          </div>
          <div className="footer-col">
            <h4>Resources</h4>
            <a href={MANAGEMENT_PORTAL_URL} target="_blank" rel="noreferrer">Management Portal</a>
            <Link href="/documents/">Public Documents</Link>
            <Link href="/latest-updates/">Announcements</Link>
          </div>
        </div>
        <div className="footer-bottom">
          © {year} SMART-SB Public Portal · Santa Cruz Sangguniang Bayan
        </div>
      </div>
    </footer>
  );
}
