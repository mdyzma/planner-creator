import type { NextConfig } from 'next';

/**
 * Static export: all project data lives in the browser (IndexedDB), so the site is plain files
 * served from Cloudflare Workers Static Assets (docs/adr/0008).
 */
const nextConfig: NextConfig = {
  output: 'export',
  transpilePackages: ['@planner/schema', '@planner/storage'],
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BUILD_SHA: (process.env.GITHUB_SHA ?? 'local').slice(0, 7),
  },
};

export default nextConfig;
