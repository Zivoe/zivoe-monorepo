import type { NextConfig } from 'next';

import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    staleTimes: {
      dynamic: 30,
      static: 300
    }
  },

  async rewrites() {
    return [
      {
        source: '/vd3asd/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      {
        source: '/vd3asd/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      },
      {
        source: '/vd3asd/decide',
        destination: 'https://us.i.posthog.com/decide'
      }
    ];
  }
};

module.exports = withSentryConfig(nextConfig, {
  org: 'TODO',
  project: 'TODO',
  widenClientFileUpload: true,
  tunnelRoute: '/ng93dn',
  disableLogger: true
});
