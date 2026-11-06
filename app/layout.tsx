import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import { SITE_URL } from '../lib/config';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: SITE_URL ? new URL(SITE_URL) : undefined,
  robots: { index: true, follow: true },
  openGraph: { type: 'website', siteName: 'SMART-SB', locale: 'en_PH', images: ['/images/logo.png'] },
  title: { default: 'SMART SB', template: '%s · SMART SB' },
  description:
    'Streamlined, Modernized, Accessible Records for Transparency Sangguniang Bayan public portal.',
  appleWebApp: { capable: true, title: 'SMART SB Portal', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#2563eb' };

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
