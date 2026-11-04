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
 * Local dev behind a tunnel (the Tailscale funnel the Persona sandbox webhook points at): `APP_URL`
 * names it so QStash callbacks and the drift check reach this machine, not localhost. A zivoe.com
 * value — production's, pulled into a local .env — is refused, so no local .env can point local
 * jobs at a deployment.
 */
const tunnel = env.APP_URL && !isZivoeHost(env.APP_URL) ? env.APP_URL : undefined;

function isZivoeHost(url: string) {
  const host = new URL(url).hostname.toLowerCase();
  return host === 'zivoe.com' || host.endsWith('.zivoe.com');
}

/**
 * `ORIGINS`: every origin this deployment answers on, which better-auth trusts as a request origin
 * and redirect target. `BASE_URL`: the one links and jobs name when no request is at hand. Both by
 * Vercel environment: production is its domain (`APP_URL` pins it), a preview is its deployment URL
 * and branch alias, local dev is localhost — or the tunnel above, when `APP_URL` names one.
 */
export const { ORIGINS, BASE_URL } = {
  production: { ORIGINS: [production], BASE_URL: production },
  preview: { ORIGINS: preview, BASE_URL: preview[0] ?? LOCAL_ORIGIN },
  development: { ORIGINS: tunnel ? [LOCAL_ORIGIN, tunnel] : [LOCAL_ORIGIN], BASE_URL: tunnel ?? LOCAL_ORIGIN }
}[env.VERCEL_ENV];
