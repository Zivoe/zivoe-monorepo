import { env } from '@/env';

/**
 * PostHog runs on every Vercel deployment and never locally: production reports to the
 * "Zivoe" project and previews to "Zivoe - staging", each through the NEXT_PUBLIC_POSTHOG_KEY
 * its Vercel environment carries. A local run keeps whatever key it has and sends nothing.
 * The kyc flag is the one exception: it is read in production only (server/kyc/kyc-flag.ts).
 */
export const POSTHOG_ENABLED = env.NEXT_PUBLIC_VERCEL_ENV !== 'development';
