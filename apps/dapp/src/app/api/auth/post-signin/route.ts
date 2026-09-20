import { type NextRequest, NextResponse } from 'next/server';

import { getUser, isUserOnboarded } from '@/server/data/auth';

import { lighthouseReturnUrl, onboardedDestination, withNext } from '@/lib/lighthouse';

/** Decides where a signed-in user lands: onboarding, the dapp, or, via the pass route, the Lighthouse page in `next`. */
export async function GET(request: NextRequest) {
  const next = lighthouseReturnUrl(request.nextUrl.searchParams.get('next'));
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // The session is gone: sign in again, keeping the way back to Lighthouse.
  const { user } = await getUser();
  if (!user) return redirectTo(withNext('/sign-in', next));

  // Onboarding keeps the way back to Lighthouse and hands the user to the pass route once they finish.
  const isOnboarded = await isUserOnboarded(user.id);
  if (!isOnboarded) return redirectTo(withNext('/onboarding', next));

  return redirectTo(onboardedDestination(next));
}
