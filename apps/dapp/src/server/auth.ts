import 'server-only';

import * as Sentry from '@sentry/nextjs';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { emailOTP } from 'better-auth/plugins';
import { eq } from 'drizzle-orm';

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
      '/email-otp/send-verification-otp': { window: 60, max: 3 },
      '/sign-in/*': { window: 60, max: 10 }
    },
    customStorage: {
      get: async (key: string) => {
        const data = await redis.get<{ key: string; count: number; lastRequest: number }>(key);
        return data ?? undefined;
      },
      set: async (key: string, value: { key: string; count: number; lastRequest: number }) => {
        // Store with 60 second TTL (matching the window)
        await redis.set(key, value, { ex: 60 });
      }
    }
  },

  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 300, // 5 minutes
      storeOTP: 'hashed',

      async sendVerificationOTP({ email, otp, type }) {
        if (type !== 'sign-in') return;

        const { err } = await handlePromise(
          sendOTPEmail({
            to: email,
            otp
          })
        );

        if (err) Sentry.captureException(err, { tags: { source: 'SERVER', flow: 'send-otp' } });
      }
    }),

    nextCookies()
  ],

  socialProviders: {
    google: {
      prompt: 'select_account',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: `${BASE_URL}/api/auth/callback/google`
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
          }
        }
      }
    }
  }
});
