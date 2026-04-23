import type { NextConfig } from 'next';

import { withSentryConfig } from '@sentry/nextjs';

import { env } from './src/env';

const insightsMediaUrl = new URL(env.NEXT_PUBLIC_INSIGHTS_MEDIA_URL);

const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,
      static: 180
    }
  },

  images: {
    remotePatterns: [
      {
        protocol: insightsMediaUrl.protocol.replace(':', '') as 'http' | 'https',
        hostname: insightsMediaUrl.hostname,
        pathname: '/**'
      }
    ]
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
      }
    ];
  }
};

module.exports = withSentryConfig(nextConfig, {
  org: 'zivoe',
  project: 'landing',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  tunnelRoute: true,
  disableLogger: true,
  reactComponentAnnotation: { enabled: true }
});
