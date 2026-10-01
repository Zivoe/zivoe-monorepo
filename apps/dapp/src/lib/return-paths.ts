/**
 * Dapp pages a signed-out visitor is returned to once signed in: the ones
 * emails link to. Only these ride along as `next` (see lib/lighthouse.ts),
 * so `next` can never become an open redirect. Free of `@/env` so the proxy
 * can import it.
 */
const DAPP_RETURN_PATHS = new Set(['/verification']);

export function isDappReturnPath(path: unknown): path is string {
  return typeof path === 'string' && DAPP_RETURN_PATHS.has(path);
}
