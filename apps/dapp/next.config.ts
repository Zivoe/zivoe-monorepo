import type { NextConfig } from 'next';

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

module.exports = nextConfig;
