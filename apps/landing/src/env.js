import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    DATABASE_URI: z.string(),
    NETWORK: z.enum(['MAINNET', 'SEPOLIA']),
    BEEHIIV_PUBLICATION_ID: z.string(),
    BEEHIIV_API_KEY: z.string(),
    TURNSTILE_SECRET_KEY: z.string(),
    REVALIDATE_API_KEY: z.string(),
    SENTRY_AUTH_TOKEN: z.string()
  },

  client: {
    NEXT_PUBLIC_ENV: z.enum(['production', 'development']),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string(),
    NEXT_PUBLIC_INTERCOM_APP_ID: z.string()
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URI: process.env.DATABASE_URI,
    NETWORK: process.env.NETWORK,
    BEEHIIV_PUBLICATION_ID: process.env.BEEHIIV_PUBLICATION_ID,
    BEEHIIV_API_KEY: process.env.BEEHIIV_API_KEY,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    REVALIDATE_API_KEY: process.env.REVALIDATE_API_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_INTERCOM_APP_ID: process.env.NEXT_PUBLIC_INTERCOM_APP_ID
  },

  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true
});
