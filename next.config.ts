import type { NextConfig } from 'next';

// Static export -> ./out  (deployed as-is to Cloudflare Pages)
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,        // /documents/ -> documents/index.html (no redirects needed on Pages)
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
