import { timingSafeEqual } from 'node:crypto';

// Policy for the agent sign-in: who may call it, as pure functions the route files feed at
// request time so every branch is table-tested.
//
// Two entry points, two gates:
//
//   Local (`next dev`) — isAgentSignInAllowed. NODE_ENV is `development` only under
//   `next dev`, and Next inlines it at build time, so the local branch in route.ts is dead
//   code in any deployed build. The other two layers bound accidents rather than a
//   determined caller. `next dev` listens on every interface, and Next fills
//   `x-forwarded-for` from the socket only when the caller sent none, so anyone on the same
//   network can send a loopback value and pass: the check stops other machines' browsers,
//   not curl. `Sec-Fetch-Site` is the browser's own claim, there so a malicious page cannot
//   navigate the developer onto the agent session — pages cannot forge it. The session
//   lands in whatever database DATABASE_URL names; pointing a dev server at a deployed
//   database is a configuration decision, not something this code second-guesses.
//
//   Preview (Vercel) — isPreviewAgentEnvironment plus isPresentedSecretValid. Both a
//   runtime `VERCEL_ENV === 'preview'` and a secret that only Preview deployments carry
//   must hold, and the routes wrap the whole path in an inlined NEXT_PUBLIC_ENV comparison
//   so a production build has no live code either. One precondition lives in configuration
//   and cannot be checked here: Preview must have its own DATABASE_URL and
//   BETTER_AUTH_SECRET, or a session minted on a preview is a production session.
//
// Every refusal answers 404.

/** Loopback in the spellings the header carries — `::1`, `127.x.x.x`, the IPv4-mapped form — anchored so a forwarded chain is refused. */
const LOOPBACK_ADDRESS = /^(?:::1|(?:::ffff:)?127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;

/**
 * `Sec-Fetch-Site` values a legitimate arrival carries: absent (curl, an agent's own HTTP
 * call, browsers without Fetch Metadata), `none` (address bar), `same-origin` (a link in
 * the dapp). An allowlist rather than `!== 'cross-site'`: `same-site` on localhost means
 * another app on another port, and a future value should be a decision, not a default.
 */
export const ALLOWED_FETCH_SITES = new Set<string | null>([null, 'none', 'same-origin']);

export function isAgentSignInAllowed({
  nodeEnv,
  forwardedFor,
  fetchSite
}: {
  nodeEnv: string | undefined;
  /** The request's `x-forwarded-for`, or null when the header is missing. */
  forwardedFor: string | null;
  /** The request's `Sec-Fetch-Site`, or null for a caller that sends none. */
  fetchSite: string | null;
}) {
  return (
    nodeEnv === 'development' &&
    forwardedFor !== null &&
    LOOPBACK_ADDRESS.test(forwardedFor.trim()) &&
    ALLOWED_FETCH_SITES.has(fetchSite)
  );
}

/**
 * Whether this process is a Vercel Preview deployment with the agent secret configured.
 * `VERCEL_ENV` is set by the platform at runtime; the secret is a Vercel variable scoped
 * to Preview, so production deployments never carry it and fail here regardless of the
 * environment check.
 */
export function isPreviewAgentEnvironment({
  vercel,
  vercelEnv,
  configuredSecret
}: {
  vercel: string | undefined;
  vercelEnv: string | undefined;
  configuredSecret: string | undefined;
}) {
  return vercel === '1' && vercelEnv === 'preview' && !!configuredSecret;
}

/** Constant-time comparison of the presented secret with the configured one; unequal lengths are refused first, as timingSafeEqual requires. */
export function isPresentedSecretValid({
  configuredSecret,
  presentedSecret
}: {
  configuredSecret: string | undefined;
  presentedSecret: string | null;
}) {
  if (!configuredSecret || !presentedSecret) return false;

  const configured = Buffer.from(configuredSecret);
  const presented = Buffer.from(presentedSecret);
  return configured.length === presented.length && timingSafeEqual(configured, presented);
}

/** The token of an `Authorization: Bearer <token>` header, or null for any other shape. */
export function bearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(\S+)\s*$/i);
  return match?.[1] ?? null;
}

/**
 * The shape of a token the magic-link plugin issues (32 ASCII letters), checked before the
 * redeem route touches the database: a lookup there also sweeps expired rows from the
 * shared verification table, and a stray path segment should not pay for that.
 */
export function isAgentTokenShaped(token: string) {
  return /^[A-Za-z]{32}$/.test(token);
}

/**
 * A redirect target with its origin dropped. better-auth resolves redirects against
 * BASE_URL, which may name a different origin than the one the agent called (a pulled
 * APP_URL locally, VERCEL_URL when the agent used the branch alias); the session cookie is
 * host-only for the serving host, so following an absolute redirect off-origin would
 * strand the agent signed out. Path and query survive, so `?error=` reaches the sign-in page.
 */
export function toOriginRelative(location: string, requestUrl: string) {
  const target = new URL(location, requestUrl);
  return target.pathname + target.search;
}
