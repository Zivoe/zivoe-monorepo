import 'server-only';

import { after } from 'next/server';

import * as Sentry from '@sentry/nextjs';
import { Ratelimit } from '@upstash/ratelimit';
import { type BetterAuthOptions, betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { captcha, emailOTP, oAuthProxy } from 'better-auth/plugins';

import { AGENT_ACCOUNT } from '@zivoe/database/agent';
import * as schema from '@zivoe/database/schema';

import { WITH_TURNSTILE } from '@/types/constants';

import { captureServerEvent } from '@/server/utils/analytics';
import { BASE_URL, ORIGINS, PRODUCTION_ORIGIN } from '@/server/utils/base-url';
import { subscribeToBeehiiv } from '@/server/utils/beehiiv';
import { googleVouchesFor } from '@/server/utils/google-email';
import { sendOTPEmail } from '@/server/utils/send-email';

import { QSTASH_JOB_LABELS, getQstashFailureCallback } from '@/lib/qstash';
import { handlePromise } from '@/lib/utils';

import { env } from '@/env';

import { db } from './clients/db';
import { qstash } from './clients/qstash';
import { redis } from './clients/redis';

type DappAuthSession = {
  user: {
    id: string;
    email: string;
  };
} | null;

type DappAuth = {
  handler: (request: Request) => Promise<Response>;
  api: {
    getSession: (options: { headers: unknown }) => Promise<DappAuthSession>;
    signOut: (options: { headers: unknown }) => Promise<unknown>;
  };
};

/** The social sign-in behind a better-auth endpoint path, or undefined for the rest. */
const socialProviderOf = (ctx: { path?: string; params?: Record<string, string | undefined> } | null | undefined) =>
  ctx?.path?.startsWith('/callback/') ? ctx.params?.id : undefined;

/**
 * The endpoints that turn a profile production sealed into a session. Only a preview may answer
 * them: anywhere else the secret every preview holds would sign anyone in. The deprecated one is
 * never answered; 1.7 hands sign-ins to the first, and a stray call to the second has no good reason.
 */
const PROXY_COMPLETION_PATH = '/callback/:id/oauth-proxy';
const DEPRECATED_PROXY_COMPLETION_PATH = '/oauth-proxy-callback';

/** One Upstash limiter per rule, made on first use: better-auth names the rule with every call. */
const limiters = new Map<string, Ratelimit>();
const limiterFor = ({ window, max }: { window: number; max: number }) => {
  const id = `${window}:${max}`;
  const limiter =
    limiters.get(id) ??
    new Ratelimit({ redis, limiter: Ratelimit.fixedWindow(max, `${window} s`), prefix: 'better-auth' });
  limiters.set(id, limiter);
  return limiter;
};

/** Google's tokens are not kept: nothing reads them, and a leaked row would otherwise carry them. */
const withoutProviderTokens = async <Account extends object>(account: Account) => ({
  data: {
    ...account,
    accessToken: null,
    refreshToken: null,
    idToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null
  }
});

/**
 * The dapp's better-auth configuration, exported apart from the instance so the agent
 * sign-in (app/api/agent-sign-in/mint.ts) can build a second instance
 * from the exact same options — same secret, same session table, same hooks — plus the
 * one plugin it needs. Keep dev-only plugins out of this object: anything added here
 * ships to production.
 */
export const authOptions = {
  baseURL: BASE_URL,
  basePath: '/api/auth',

  // The OAuth state lives in an encrypted cookie on the host that started the sign-in, so only that
  // browser can finish it. With the database-backed default the proxy's completion skips the state
  // cookie, and anyone handed a preview's completion URL would be signed in as whoever started it.
  account: { storeStateStrategy: 'cookie' },

  onAPIError: {
    errorURL: '/sign-in'
  },

  // Nothing of ours calls these; a live endpoint that takes a user-supplied name or links a second
  // provider is only a surface to attack. The proxy's deprecated completion endpoint goes with them.
  disabledPaths: ['/update-user', '/link-social', '/unlink-account', DEPRECATED_PROXY_COMPLETION_PATH],

  database: drizzleAdapter(db, {
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
      consume: async (key, rule) => {
        const { success, reason, reset } = await limiterFor(rule).limit(key);
        // Upstash answers a check it could not finish in time as a success; a limit nobody counted
        // is no limit, so it is refused like any other Redis failure (a 500, not a 429).
        if (reason === 'timeout') throw new Error('Rate limit check timed out');

        return { allowed: success, retryAfter: success ? null : Math.max(1, Math.ceil((reset - Date.now()) / 1000)) };
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
          throw err instanceof Error ? err : new Error('Failed to send OTP email', { cause: err });
        }
      }
    }),

    // Google and X accept exact redirect URIs only, and a Vercel preview has a new host every time:
    // a preview asks them to call production back, and production hands the sealed profile to the
    // preview, which makes the user and session in its own database. Shared by every deployment on
    // Vercel; local dev registers its own redirect URI and runs without it.
    ...(env.VERCEL_ENV !== 'development' && env.OAUTH_PROXY_SECRET
      ? [oAuthProxy({ productionURL: PRODUCTION_ORIGIN, secret: env.OAUTH_PROXY_SECRET })]
      : []),

    nextCookies()
  ],

  socialProviders: {
    google: {
      prompt: 'select_account',
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // A token handed over by a client is not a way in; sign-in starts with a redirect or not at all.
      disableIdTokenSignIn: true,
      // Google's word on an address is good only where Google is its mailbox (`googleVouchesFor`).
      // Without it a sign-in neither joins an existing user (`account_not_linked`) nor creates one
      // (`user.create.before`). A Google identity linked before this rule keeps signing in: the
      // link, not the address, is what identifies it then.
      mapProfileToUser: (profile) => ({ emailVerified: googleVouchesFor(profile) })
    },
    twitter: {
      clientId: env.TWITTER_CLIENT_ID,
      clientSecret: env.TWITTER_CLIENT_SECRET,
      disableIdTokenSignIn: true,
      // X confirmed its users' addresses once, at sign-up, which is the same stale word as Google's
      // on a non-Gmail address: never enough to join an existing user, whose code proved the
      // mailbox now. X users sign up as their own, unverified user instead, as they always did.
      mapProfileToUser: () => ({ emailVerified: false })
    }
  },

  trustedOrigins: ORIGINS,

  advanced: {
    ipAddress: {
      ipAddressHeaders: ['x-real-ip', 'x-forwarded-for']
    },

    database: {
      generateId: false // Use PostgreSQL's gen_random_uuid()
    }
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === PROXY_COMPLETION_PATH && env.VERCEL_ENV !== 'preview') throw new APIError('NOT_FOUND');

      // X caps `state` at 500 characters and the sealed package the proxy sends through it is about
      // four times that, so X stays production-and-local; the page shows the message as a toast.
      if (ctx.path === '/sign-in/social' && ctx.body?.provider === 'twitter' && env.VERCEL_ENV === 'preview') {
        throw new APIError('BAD_REQUEST', {
          code: 'x_unavailable_on_previews',
          message: 'X sign-in is not available on preview deployments. Sign in with a code sent to your email.'
        });
      }
    }),

    // The one place a sign-in is known to have succeeded: a session was just created. A first
    // sign-in counts here too, next to the `auth:sign-up` from `user.create.after`.
    after: createAuthMiddleware(async (ctx) => {
      const user = ctx.context.newSession?.user;
      if (!user) return;

      const method = ctx.path === '/sign-in/email-otp' ? 'email_otp' : socialProviderOf(ctx);
      if (!method) return;

      after(() => captureServerEvent({ distinctId: user.id, event: 'auth:sign-in', properties: { method } }));
    })
  },

  databaseHooks: {
    // Google's and X's tokens are not kept.
    account: { create: { before: withoutProviderTokens }, update: { before: withoutProviderTokens } },

    session: {
      update: {
        // Agent sessions are minted with a one-hour expiry (app/api/agent-sign-in/mint.ts).
        // getSession refreshes any session with under six days left back to the full seven,
        // which would undo that cap on the first read, so keep the row's current expiry.
        // getSession is the only caller that updates expiresAt, and it sets ctx.context.session
        // to the session it is refreshing first, so that is the session being pinned.
        before: async (update, ctx) => {
          const current = ctx?.context.session;
          if (!current || update.expiresAt === undefined || current.user.email !== AGENT_ACCOUNT.email) return;

          return { data: { expiresAt: current.session.expiresAt } };
        }
      }
    },

    user: {
      create: {
        // Thrown rather than refused with `false`, which better-auth only turns into an error by
        // accident (a null user dereferenced and caught); the code lands on the sign-in page as copy.
        before: async (user, ctx) => {
          const provider = socialProviderOf(ctx);

          // A Google sign-in whose address Google cannot vouch for (`mapProfileToUser`) creates no
          // user: the row would wait, Google identity attached, for the address's owner to claim it
          // by code. X signs its users up unverified by design, so only Google is refused here.
          if (provider === 'google' && !user.emailVerified) {
            throw new APIError('FORBIDDEN', {
              code: 'email_not_verified',
              message: 'Google cannot vouch for this email'
            });
          }

          // 1.7 gives an X user who shares no email a placeholder address (`<id>@twitter.placeholder.invalid`)
          // where 1.4 refused the sign-in. The dapp needs a real mailbox (codes, notices, KYC), so the
          // refusal stays.
          if (provider === 'twitter' && user.email.endsWith('.placeholder.invalid')) {
            throw new APIError('FORBIDDEN', { code: 'email_not_found', message: 'X shared no email address' });
          }
        },

        after: async (user) => {
          after(async () => {
            const flows = ['sign-up-subscribe-newsletter', 'sign-up-schedule-reminder', 'sign-up-posthog-capture'];

            const results = await Promise.allSettled([
              // One Beehiiv publication serves every environment, so only production
              // sign-ups reach the real newsletter list (same gate as analytics).
              env.NEXT_PUBLIC_ENV === 'production'
                ? subscribeToBeehiiv({
                    email: user.email,
                    utmSource: 'dapp-v2',
                    sendWelcomeEmail: false
                  })
                : Promise.resolve(),

              // Nudges users who signed up but never completed onboarding; the
              // route no-ops if they finished in the meantime.
              qstash.publishJSON({
                url: `${BASE_URL}/api/email/onboarding-reminder`,
                body: { userId: user.id },
                delay: '1d',
                retries: 3,
                deduplicationId: `onboarding-reminder-1day-${user.id}`,
                failureCallback: getQstashFailureCallback(BASE_URL),
                label: QSTASH_JOB_LABELS.emailOnboardingReminder
              }),

              captureServerEvent({
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
} satisfies BetterAuthOptions;

export const auth: DappAuth = betterAuth(authOptions) as unknown as DappAuth;
