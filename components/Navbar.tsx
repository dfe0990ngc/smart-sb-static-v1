'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { MANAGEMENT_PORTAL_URL } from '../lib/config';

const navigation = [
  { href: '/', label: 'Home' },
  { href: '/sb-members/', label: 'Members' },
  { href: '/documents/', label: 'Legislations' },
  { href: '/latest-updates/', label: 'News & Updates' },
];

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, '') : p);

export function Navbar() {
  const pathname = norm(usePathname() || '/');
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === norm(href) || pathname.startsWith(norm(href) + '/');

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <header className="site-header">
        <nav className="container nav-shell" aria-label="Main navigation">
          <Link className="brand" href="/" aria-label="SMART-SB Home">
            <div className="brand-image-mobile" style={{ marginRight: 8 }}>
              <img src="/images/lgu-logo.svg" alt="LGU Logo" className="brand-image" />
              <img src="/images/sb-logo.svg" alt="SB Logo" className="brand-image" />
            </div>
            <span>
              <strong className="text-primary">SMART-SB</strong>
              <small>SANTA CRUZ, DAVAO DEL SUR</small>
            </span>
          </Link>

          <div className="nav-links">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={isActive(item.href) ? 'active' : ''}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </div>

          <a className="portal-button" href={MANAGEMENT_PORTAL_URL} target="_blank" rel="noreferrer">
            ↪ Management Portal
          </a>

          <button
            className={`nav-toggle${open ? ' open' : ''}`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-drawer"
          >
            <span />
            <span />
            <span />
          </button>
        </nav>
      </header>

      <div id="mobile-drawer" className={`mobile-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
        <nav className="drawer-panel" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <Link key={item.href} href={item.href} className={isActive(item.href) ? 'active' : ''}>
              {item.label}
            </Link>
          ))}
          <div className="drawer-divider" style={{ marginTop: 4 }} />
          <a className="drawer-portal-btn" href={MANAGEMENT_PORTAL_URL} target="_blank" rel="noreferrer">
            ↪ Management Portal
          </a>
        </nav>
      </div>
    </>
  );
}
