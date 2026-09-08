// Policy for the agent sign-in: who may call it and what this process may mint against,
// as pure functions the route file feeds at request time so every branch is table-tested.
//
//   Local (`next dev`) — isAgentSignInAllowed. NODE_ENV is `development` only under
//   `next dev`, and Next inlines it at build time, so the local branch in route.ts is dead
//   code in any deployed build. The other two layers bound accidents rather than a
//   determined caller. `next dev` listens on every interface, and Next fills
//   `x-forwarded-for` from the socket only when the caller sent none, so anyone on the same
//   network can send a loopback value and pass: the check stops other machines' browsers,
//   not curl. `Sec-Fetch-Site` is the browser's own claim, there so a malicious page cannot
//   navigate the developer onto the agent session — pages cannot forge it. isLocalDatabase
//   is what actually bounds the local path: whatever a caller obtains is a session in the
//   developer's own database.
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

/** Loopback database hosts, including the bracketed IPv6 form `new URL().hostname` reports. */
const LOOPBACK_HOSTNAME = /^(?:localhost|\[::1\]|127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i;

/**
 * Whether the database this process would write to lives on this machine — what decides
 * whether the local path may mint at all. NODE_ENV describes the server, not the data:
 * `vercel env pull` brings a deployed DATABASE_URL onto a laptop, and `next dev` against it
 * would create the agent in that database. A URL that does not parse or names no host is
 * refused. A local port forwarded to a remote database still reads as local; this bounds
 * accidents, not a developer determined to do it anyway.
 */
export function isLocalDatabase(databaseUrl: string) {
  try {
    return LOOPBACK_HOSTNAME.test(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
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
