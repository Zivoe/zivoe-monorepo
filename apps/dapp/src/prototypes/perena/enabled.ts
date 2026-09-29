import 'server-only';

import { env } from '@/env';

import { isPerenaDemoAllowed } from './gate';

export function isPerenaDemoEnabled() {
  return isPerenaDemoAllowed({
    enabled: env.PERENA_DEMO_ENABLED,
    nodeEnv: process.env.NODE_ENV,
    publicEnv: process.env.NEXT_PUBLIC_ENV,
    vercel: env.VERCEL,
    vercelEnv: env.VERCEL_ENV
  });
}
