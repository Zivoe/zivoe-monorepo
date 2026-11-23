/**
 * Dapp pages a signed-out visitor is returned to once signed in: the ones
 * emails link to. Only these ride along as `next` (see lib/lighthouse.ts),
 * so `next` can never become an open redirect. Free of `@/env` so the proxy
 * can import it.
 */
import { z } from 'zod';

const DAPP_RETURN_PATHS = new Set(['/verification']);

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** One exact shape: a lowercase UUID, nothing after it, so it stays a page of ours and carries nothing else. */
const INVITATION_PATH = new RegExp(`^/invitations/${UUID}$`);

/** `/verification` on one subject, as an organization's status email links it: the same exact-shape rule. */
const VERIFICATION_SUBJECT_PATH = new RegExp(`^/verification\\?subject=${UUID}$`);

/**
 * The return path for `/verification`, keeping the subject it was opened on when that is a well-formed id,
 * so signing in again does not land a member on themselves instead of their organization.
 */
export const verificationReturnPath = (subject: unknown) => {
  const path = typeof subject === 'string' ? `/verification?subject=${subject}` : '/verification';
  return VERIFICATION_SUBJECT_PATH.test(path) ? path : '/verification';
};

export const isInvitationPath = (path: unknown): path is string =>
  typeof path === 'string' && INVITATION_PATH.test(path);

/**
 * An invitation's link, as its email and "Copy invite link" give it: the invited address rides in the
 * fragment (`#email=`) so sign-in can prefill it. A fragment never reaches the server (no request, log or
 * Referer carries it), browsers keep it across the proxy's redirect to sign-in, and the page takes it off the
 * URL before Sentry or PostHog start (lib/invited-email.ts); what they read of the URL the page was opened
 * with, the page-load timing entry, is scrubbed (lib/analytics/scrub.ts).
 * Nothing checks it against the invitation: a wrong one only fills the field, and signing in with it
 * leads to "This invitation is for another account".
 */
export const invitationLinkPath = ({ invitationId, email }: { invitationId: string; email: string }) =>
  `/invitations/${invitationId}#${new URLSearchParams({ email })}`;

const invitedEmailSchema = z.string().trim().email().max(254);

/** The address an invitation link's fragment (`location.hash`) carries, when it reads as one; else null. */
export const invitedEmailOf = (hash: string) => {
  const parsed = invitedEmailSchema.safeParse(new URLSearchParams(hash.replace(/^#/, '')).get('email'));
  return parsed.success ? parsed.data : null;
};

export function isDappReturnPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    (DAPP_RETURN_PATHS.has(path) || isInvitationPath(path) || VERIFICATION_SUBJECT_PATH.test(path))
  );
}
