/**
 * Whether Google's word on an address is good: only where Google is its mailbox, a Gmail address or a
 * Google Workspace domain (`hd`). Any other address Google checked once, when the account was made,
 * and the mailbox may have changed hands since; an email code proves it now. Feeds the Google
 * provider's `emailVerified` (server/auth.ts).
 */
export function googleVouchesFor(profile: { email: string; email_verified?: boolean; hd?: string }) {
  if (profile.email_verified !== true) return false;

  return /@(gmail|googlemail)\.com$/i.test(profile.email) || Boolean(profile.hd);
}
