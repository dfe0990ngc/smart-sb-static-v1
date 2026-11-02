import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Footer } from '../components/Footer';
import { Navbar } from '../components/Navbar';
import './globals.css';

export const metadata: Metadata = {
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
