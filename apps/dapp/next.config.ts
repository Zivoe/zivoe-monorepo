import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    staleTimes: {
      dynamic: 30,
      static: 180
    },
    dynamicIO: true,
    cacheLife: {
      hourly: {
        stale: 600, // 10 minutes
        revalidate: 1800, // 30 minutes
        expire: 3600 // 1 hour
      }
    }
  }
};

module.exports = nextConfig;
