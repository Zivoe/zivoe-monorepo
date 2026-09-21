/**
 * Lighthouse has no sign-in of its own. It lets a visitor in only with a pass, a signed cookie the
 * dapp issues to signed-in, onboarded users (server/utils/lighthouse-pass.ts). Lighthouse sends
 * everyone else to `/api/lighthouse/pass?next=<lighthouse url>`, and `next` rides along through
 * sign-in and onboarding until that route can issue the pass and return the visitor.
 * Every link out and every redirect goes to production Lighthouse, whatever environment the dapp runs in.
 */
export const LIGHTHOUSE_URL = 'https://lighthouse.zivoe.com';

/**
 * The Lighthouse page to return to after sign-in and onboarding, or undefined when `next` is not one, so `next`
 * can never become an open redirect. The query is dropped and the path is limited to characters
 * better-auth accepts inside a social sign-in `callbackURL`.
 */
export function lighthouseReturnUrl(next: string | Array<string> | null | undefined) {
  if (typeof next !== 'string' || !URL.canParse(next)) return undefined;

  const url = new URL(next);
  if (url.origin !== LIGHTHOUSE_URL || !/^\/(?!\/)[\w\-./]*$/.test(url.pathname)) return undefined;

  return `${url.origin}${url.pathname}`;
}

/** Carries the Lighthouse return URL on a dapp path so it survives sign-in and onboarding. */
export function withNext(path: string, next: string | undefined) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

/**
 * Where a signed-in, onboarded user lands: the dapp, or, when Lighthouse sent them, the pass route,
 * so they arrive at the Lighthouse page in `next` holding a pass.
 */
export function onboardedDestination(next: string | undefined) {
  return next ? withNext('/api/lighthouse/pass', next) : '/';
}
