/**
 * The `?error=` a failed sign-in comes back to the page with, as a toast. Google and X refusals,
 * better-auth's own OAuth codes and the proxy's (`state_mismatch`, `payload_expired`, …) all land
 * here; anything unnamed gets the generic toast.
 */
export function signInRefusal(code: string): { title: string; description?: string } {
  switch (code) {
    case 'access_denied':
      return { title: 'Sign In Cancelled', description: 'You cancelled the sign-in.' };
    case 'account_not_linked':
      return {
        title: 'Sign In Failed',
        description:
          "This sign-in method can't vouch for your email address, so it can't be joined to your account. Sign in with a code sent to your email instead."
      };
    case 'unable_to_create_user':
    case 'email_not_verified':
      return {
        title: 'Sign In Failed',
        description:
          "This sign-in method can't vouch for your email address. Sign in with a code sent to your email instead."
      };
    case 'email_not_found':
      return {
        title: 'Sign In Failed',
        description:
          "This sign-in method didn't share an email address. Sign in with a code sent to your email instead."
      };
    default:
      return { title: 'Sign In Failed' };
  }
}
