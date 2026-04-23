import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    DATABASE_URI: z.string(),
    BEEHIIV_PUBLICATION_ID: z.string(),
    BEEHIIV_API_KEY: z.string(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    TURNSTILE_SECRET_KEY: z.string(),
    REVALIDATE_API_KEY: z.string(),
    INSIGHTS_PREVIEW_SECRET: z.string()
  },

  client: {
    NEXT_PUBLIC_ENV: z.enum(['production', 'development']),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string(),
    NEXT_PUBLIC_INTERCOM_APP_ID: z.string(),
    NEXT_PUBLIC_INSIGHTS_CMS_URL: z.string().url(),
    NEXT_PUBLIC_INSIGHTS_MEDIA_URL: z.string().url()
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URI: process.env.DATABASE_URI,
    BEEHIIV_PUBLICATION_ID: process.env.BEEHIIV_PUBLICATION_ID,
    BEEHIIV_API_KEY: process.env.BEEHIIV_API_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    REVALIDATE_API_KEY: process.env.REVALIDATE_API_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    INSIGHTS_PREVIEW_SECRET: process.env.INSIGHTS_PREVIEW_SECRET,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_INTERCOM_APP_ID: process.env.NEXT_PUBLIC_INTERCOM_APP_ID,
    NEXT_PUBLIC_INSIGHTS_CMS_URL: process.env.NEXT_PUBLIC_INSIGHTS_CMS_URL,
    NEXT_PUBLIC_INSIGHTS_MEDIA_URL: process.env.NEXT_PUBLIC_INSIGHTS_MEDIA_URL
  },

  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true
});
