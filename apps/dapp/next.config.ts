import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: true,
    staleTimes: {
      dynamic: 30,
      static: 300
    },
    dynamicIO: true
  }
};

module.exports = nextConfig;
