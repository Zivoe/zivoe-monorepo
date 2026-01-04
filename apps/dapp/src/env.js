import { createEnv } from '@t3-oss/env-nextjs';
import { z } from 'zod';

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(['development', 'test', 'production']),
    DATABASE_URI: z.string(),
    PONDER_MAINNET_DATABASE_URL: z.string(),
    QSTASH_TOKEN: z.string(),
    QSTASH_CURRENT_SIGNING_KEY: z.string(),
    QSTASH_NEXT_SIGNING_KEY: z.string(),
    UPSTASH_REDIS_REST_URL: z.string(),
    UPSTASH_REDIS_REST_TOKEN: z.string(),
    LANDING_PAGE_URL: z.string().optional(),
    LANDING_PAGE_REVALIDATE_API_KEY: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string(),
    ZIVOE_API_KEY: z.string(),

    // Newsletter
    BEEHIIV_PUBLICATION_ID: z.string(),
    BEEHIIV_API_KEY: z.string(),

    // Auth
    AUTH_DATABASE_URL: z.string(),
    BETTER_AUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    TWITTER_CLIENT_ID: z.string(),
    TWITTER_CLIENT_SECRET: z.string(),
    RESEND_API_KEY: z.string(),
    RESEND_WEBHOOK_SECRET: z.string(),
    TURNSTILE_SECRET_KEY: z.string(),

    // Telegram
    TELEGRAM_BOT_TOKEN: z.string(),
    TELEGRAM_ONBOARDING_CHAT_ID: z.string(),

    // Vercel (auto-populated on Vercel)
    VERCEL: z.enum(['1', '0']).default('0'),
    VERCEL_ENV: z.enum(['production', 'preview', 'development']).default('development'),
    VERCEL_URL: z.string().optional(),
    VERCEL_BRANCH_URL: z.string().optional(),
    VERCEL_PROJECT_PRODUCTION_URL: z.string().optional()
  },

  client: {
    NEXT_PUBLIC_ENV: z.enum(['production', 'development']),
    NEXT_PUBLIC_DYNAMIC_ENV_ID: z.string(),
    NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY: z.string(),
    NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY: z.string(),
    NEXT_PUBLIC_ZIVOE_ANALYTICS_URL: z.string(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_SENTRY_DSN: z.string(),
    NEXT_PUBLIC_INTERCOM_APP_ID: z.string(),
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string()
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URI: process.env.DATABASE_URI,
    NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY: process.env.NEXT_PUBLIC_MAINNET_RPC_URL_PRIMARY,
    NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY: process.env.NEXT_PUBLIC_MAINNET_RPC_URL_SECONDARY,
    PONDER_MAINNET_DATABASE_URL: process.env.PONDER_MAINNET_DATABASE_URL,
    QSTASH_TOKEN: process.env.QSTASH_TOKEN,
    QSTASH_CURRENT_SIGNING_KEY: process.env.QSTASH_CURRENT_SIGNING_KEY,
    QSTASH_NEXT_SIGNING_KEY: process.env.QSTASH_NEXT_SIGNING_KEY,
    NEXT_PUBLIC_DYNAMIC_ENV_ID: process.env.NEXT_PUBLIC_DYNAMIC_ENV_ID,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    NEXT_PUBLIC_ZIVOE_ANALYTICS_URL: process.env.NEXT_PUBLIC_ZIVOE_ANALYTICS_URL,
    NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
    LANDING_PAGE_URL: process.env.LANDING_PAGE_URL,
    LANDING_PAGE_REVALIDATE_API_KEY: process.env.LANDING_PAGE_REVALIDATE_API_KEY,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_INTERCOM_APP_ID: process.env.NEXT_PUBLIC_INTERCOM_APP_ID,
    ZIVOE_API_KEY: process.env.ZIVOE_API_KEY,

    // Newsletter
    BEEHIIV_PUBLICATION_ID: process.env.BEEHIIV_PUBLICATION_ID,
    BEEHIIV_API_KEY: process.env.BEEHIIV_API_KEY,

    // Auth
    AUTH_DATABASE_URL: process.env.AUTH_DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
    TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_WEBHOOK_SECRET: process.env.RESEND_WEBHOOK_SECRET,
    TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,

    // Telegram
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_ONBOARDING_CHAT_ID: process.env.TELEGRAM_ONBOARDING_CHAT_ID,

    // Vercel
    VERCEL: process.env.VERCEL ?? '0',
    VERCEL_ENV: process.env.VERCEL_ENV ?? 'development',
    VERCEL_URL: process.env.VERCEL_URL,
    VERCEL_BRANCH_URL: process.env.VERCEL_BRANCH_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL
  },

  skipValidation: Boolean(process.env.SKIP_ENV_VALIDATION),
  emptyStringAsUndefined: true
});
