import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/**
 * Static export: all project data lives in the browser (IndexedDB), so the site is plain files
 * served from Cloudflare Workers Static Assets (docs/adr/0008). Interface languages are URL
 * segments (/en, /pl) prerendered at build time (§7).
 */
const nextConfig: NextConfig = {
  output: 'export',
  transpilePackages: [
    '@planner/core',
    '@planner/i18n',
    '@planner/renderer',
    '@planner/schema',
    '@planner/storage',
  ],
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.GITHUB_SHA ?? 'local').slice(0, 7),
  },
};

export default withNextIntl(nextConfig);
