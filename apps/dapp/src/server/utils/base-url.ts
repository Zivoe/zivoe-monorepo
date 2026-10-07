import 'server-only';

import { env } from '@/env';

/**
 * Production's origin, the one redirect URI Google and X know: a preview sends them there and
 * production hands the sign-in back (server/auth.ts). A constant on purpose, so no environment
 * variable can repoint the relay.
 */
export const PRODUCTION_ORIGIN = 'https://app.zivoe.com';

const LOCAL_ORIGIN = 'http://localhost:3000';

const production = env.APP_URL ?? PRODUCTION_ORIGIN;
const preview = [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
  .filter((host): host is string => Boolean(host))
  .map((host) => `https://${host}`);

/**
 * `ORIGINS`: every origin this deployment answers on, which better-auth trusts as a request origin
 * and redirect target. `BASE_URL`: the one links and jobs name when no request is at hand. Both by
 * Vercel environment: production is its domain (`APP_URL` pins it and is read nowhere else, so a
 * production value pulled into a local .env changes nothing), a preview is its deployment URL and
 * branch alias, local dev is localhost.
 */
export const { ORIGINS, BASE_URL } = {
  production: { ORIGINS: [production], BASE_URL: production },
  preview: { ORIGINS: preview, BASE_URL: preview[0] ?? LOCAL_ORIGIN },
  development: { ORIGINS: [LOCAL_ORIGIN], BASE_URL: LOCAL_ORIGIN }
}[env.VERCEL_ENV];
