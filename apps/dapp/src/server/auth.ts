import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { captcha, emailOTP } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

import { WITH_TURNSTILE } from '@/types/constants';

import { sendOTPEmail } from '@/server/utils/send-email';

import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

import { authDb } from './clients/auth-db';
import { redis } from './clients/redis';
import * as schema from './db/schema';

const BASE_URL =
  env.VERCEL_ENV === 'preview' && env.VERCEL_URL
    ? `https://${env.VERCEL_URL}`
    : env.VERCEL_ENV === 'production' && env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000';

export const auth = betterAuth({
  baseURL: BASE_URL,
  basePath: '/api/auth',

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

        // Fire and forget to avoid timing attacks (email enumeration)
        sendOTPEmail({ to: email, otp }).catch((err) => {
          Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'send-otp' } });
        });
      }
    }),

    nextCookies()
  ],

  socialProviders: {
    google: {
      prompt: 'select_account',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET
    }
  },

  trustedOrigins: () => {
    const origins: string[] = [];

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

  // create profile record on user signup (atomic: success or rollback)
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const { err } = await handlePromise(
            authDb.insert(schema.profile).values({
              id: user.id,
              createdAt: user.createdAt,
              updatedAt: user.updatedAt
            })
          );

          if (err) {
            Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'create-profile' } });

            // Rollback: delete the orphaned user to maintain data consistency
            const { err: cleanupErr } = await handlePromise(
              authDb.delete(schema.user).where(eq(schema.user.id, user.id))
            );

            if (cleanupErr) Sentry.captureException(cleanupErr, { tags: { source: 'SERVER', flow: 'cleanup-user' } });

            // Abort the auth flow - profile creation is required
            throw new APIError('INTERNAL_SERVER_ERROR', {
              message: 'Failed to complete signup. Please try again.'
            });
          }
        }
      }
    }
  }
});
