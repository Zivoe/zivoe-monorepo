import type { NextConfig } from 'next';

import { withSentryConfig } from '@sentry/nextjs';

import './src/env';

const nextConfig: NextConfig = {
  experimental: {
    ppr: 'incremental',
    staleTimes: {
      dynamic: 30,
      static: 180
    }
  },

  async rewrites() {
    return [
      {
        source: '/asbr3d/static/:path*',
        destination: 'https://us-assets.i.posthog.com/static/:path*'
      },
      {
        source: '/asbr3d/:path*',
        destination: 'https://us.i.posthog.com/:path*'
      },
      {
        source: '/asbr3d/decide',
        destination: 'https://us.i.posthog.com/decide'
      }
    ];
  }
};

module.exports = withSentryConfig(nextConfig, {
  org: 'zivoe',
  project: 'landing',
  widenClientFileUpload: true,
  tunnelRoute: true,
  disableLogger: true,
  reactComponentAnnotation: { enabled: true }
});
