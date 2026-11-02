import type { MetadataRoute } from 'next';

export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SMART SB Public Portal',
    short_name: 'SMART SB',
    description: 'Streamlined, Modernized, Accessible Records for Transparency Sangguniang Bayan public portal.',
    display: 'standalone',
    orientation: 'portrait',
    start_url: '/',
    background_color: '#ffffff',
    theme_color: '#2563eb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
