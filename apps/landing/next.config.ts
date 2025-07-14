import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
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

module.exports = nextConfig;
