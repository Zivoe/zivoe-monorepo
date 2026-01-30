import 'server-only';

import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { captcha, emailOTP } from 'better-auth/plugins';

import { WITH_TURNSTILE } from '@/types/constants';

import { BASE_URL } from '@/server/utils/base-url';
import { sendOTPEmail } from '@/server/utils/send-email';

import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

import { authDb } from './clients/auth-db';
import { posthog } from './clients/posthog';
import { qstash } from './clients/qstash';
import { redis } from './clients/redis';
import * as schema from './db/schema';

export const auth = betterAuth({
  baseURL: BASE_URL,
  basePath: '/api/auth',

  onAPIError: {
    errorURL: '/sign-in'
  },

  database: drizzleAdapter(authDb, {
    provider: 'pg',
    schema
  }),

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60 // 5 minutes
    }
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100, // 100 requests per window (global default)
    customRules: {
      '/email-otp/send-verification-otp': { window: 300, max: 4 },
      '/sign-in/email-otp': { window: 60, max: 10 },
      '/sign-in/social': { window: 60, max: 10 }
    },
    customStorage: {
      get: async (key: string) => {
        const data = await redis.get<{ key: string; count: number; lastRequest: number }>(key);
        return data ?? undefined;
      },
      set: async (key: string, value: { key: string; count: number; lastRequest: number }) => {
        // Store with 5 minute TTL (matching the longest rate limit window)
        await redis.set(key, value, { ex: 300 });
      }
    }
  },

  plugins: [
    ...(WITH_TURNSTILE
      ? [
          captcha({
            provider: 'cloudflare-turnstile',
            secretKey: env.TURNSTILE_SECRET_KEY,
            endpoints: ['/email-otp/send-verification-otp']
          })
        ]
      : []),

    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      storeOTP: 'hashed',
      allowedAttempts: 3,

      async sendVerificationOTP({ email, otp, type }) {
        if (type !== 'sign-in') return;

        // Fire and forget pattern is not needed because anyone can use the email-otp flow, you cannot gain any information from timing attacks.
        // ? Resend has a global 2 req/s limit, in the case of a big burst of requests, we might want to either
        // ? - send the email in a job with retries or
        // ? - add exponential backoff retries
        const { err } = await handlePromise(sendOTPEmail({ to: email, otp }));

        if (err) {
          Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'send-otp' } });
          throw err;
        }
      }
    }),

    nextCookies()
  ],

  socialProviders: {
    google: {
      prompt: 'select_account',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
    },
    twitter: {
      clientId: env.TWITTER_CLIENT_ID,
      clientSecret: env.TWITTER_CLIENT_SECRET
    }
  },

  trustedOrigins: () => {
    const origins: string[] = [];

    if (env.APP_URL) {
      origins.push(env.APP_URL);
    }

    if (env.VERCEL_URL) {
      origins.push(`https://${env.VERCEL_URL}`);
    }

    if (env.VERCEL_BRANCH_URL) {
      origins.push(`https://${env.VERCEL_BRANCH_URL}`);
    }

    if (env.VERCEL_PROJECT_PRODUCTION_URL) {
      origins.push(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
    }

    if (env.VERCEL_ENV === 'development') {
      origins.push('http://localhost:3000');
    }

    return origins;
  },

  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-real-ip', 'x-forwarded-for']
    },

    database: {
      generateId: false // Use PostgreSQL's gen_random_uuid()
    }
  },

  // Subscribe to newsletter and track signup on user creation
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          after(async () => {
            const flows = ['sign-up-subscribe-newsletter', 'sign-up-schedule-reminder', 'sign-up-posthog-capture'];

            const results = await Promise.allSettled([
              // Subscribe to newsletter
              fetch(`https://api.beehiiv.com/v2/publications/${env.BEEHIIV_PUBLICATION_ID}/subscriptions`, {
                method: 'POST',
                body: JSON.stringify({
                  email: user.email,
                  utm_source: 'dapp-v2',
                  send_welcome_email: false
                }),
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${env.BEEHIIV_API_KEY}`
                }
              }).then(async (res) => {
                if (!res.ok) {
                  const body = await res.text().catch(() => 'Failed to read response body');
                  throw new Error(`Beehiiv API error ${res.status}: ${body}`);
                }

                return res;
              }),

              // Schedule onboarding reminder (3 days) for users who don't complete it
              qstash.publishJSON({
                url: `${BASE_URL}/api/email/onboarding-reminder`,
                body: { userId: user.id },
                delay: '3d',
                retries: 3,
                deduplicationId: `onboarding-reminder-3day-${user.id}`,
                failureCallback: `${BASE_URL}/api/qstash/failure`
              }),

              // Track signup event
              posthog.captureImmediate({
                distinctId: user.id,
                event: 'auth:sign-up',
                properties: {
                  $set: {
                    email: user.email,
                    name: user.name,
                    created_at: user.createdAt.toISOString()
                  }
                }
              })
            ]);

            results.forEach((result, index) => {
              if (result.status === 'rejected') {
                Sentry.captureException(result.reason, {
                  tags: { source: 'SERVER', flow: flows[index] },
                  extra: { userId: user.id }
                });
              }
            });
          });
        }
      }
    }
  }
});
