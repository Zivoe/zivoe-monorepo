import './src/env.js';

/** @type {import("next").NextConfig} */
const config = {
  experimental: {
    ppr: true,
    staleTimes: {
      dynamic: 30,
      static: 180
    }
  }
};

export default config;
