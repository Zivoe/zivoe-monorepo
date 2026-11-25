import { invitedEmailOf, isInvitationPath } from './return-paths';

const STORAGE_KEY = 'invited-email';

/**
 * Runs first on every page load (instrumentation-client.ts), before Sentry and PostHog record the URL: an
 * invitation link's `#email=` (lib/return-paths.ts) leaves the address bar and history. On a sign-in that
 * returns to an invitation, the one page that uses it, the address waits in this tab's session storage for
 * `readInvitedEmail`; anywhere else (a signed-in visitor on the invitation page, onboarding) it is dropped.
 * Each load first clears what an earlier one stored, so a sign-in left before it read its address never
 * prefills a later invitation's.
 */
export function takeInvitedEmailFromUrl() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // No storage (a private window, blocked site data): nothing was kept, and sign-in shows its hint.
  }

  const { hash, pathname, search } = window.location;
  if (!hash.includes('email=')) return;
  window.history.replaceState(window.history.state, '', pathname + search);

  const email = invitedEmailOf(hash);
  // Exactly one `next`, as sign-in itself requires (lib/lighthouse.ts): a second one makes it no return path.
  const next = new URLSearchParams(search).getAll('next');
  if (pathname !== '/sign-in' || next.length !== 1 || !isInvitationPath(next[0]) || !email) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, email);
  } catch {
    // As above: sign-in shows its hint instead of prefilling.
  }
}

let taken: string | null | undefined;

/**
 * The address `takeInvitedEmailFromUrl` kept, or null. The first read takes it out of storage; it is kept for
 * the rest of the page's life, so a remount (React's dev double effects, or sign-in again after "Sign out and
 * switch account" without a page load) reads the same.
 */
export function readInvitedEmail() {
  if (taken !== undefined) return taken;
  try {
    taken = window.sessionStorage.getItem(STORAGE_KEY);
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    taken = null;
  }
  return taken;
}
