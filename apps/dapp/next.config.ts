import type { NextConfig } from 'next';

import { withSentryConfig } from '@sentry/nextjs';

import './src/env';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    staleTimes: {
      dynamic: 30,
      static: 300
    }
  },

  async redirects() {
    return [
      {
        source: '/meet/thor',
        destination: 'https://calendly.com/thor-zivoe/conversation',
        permanent: false
      },
      {
        source: '/telegram/thor',
        destination: 'https://t.me/thorabbasi',
        permanent: false
      }
    ];
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
  org: 'zivoe',
  project: 'dapp',
  widenClientFileUpload: true,
  tunnelRoute: true,
  disableLogger: true,
  reactComponentAnnotation: { enabled: true }
});
