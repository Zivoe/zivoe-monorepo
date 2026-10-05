import { type NextRequest, NextResponse } from 'next/server';

import { getRequiredStep, getUser } from '@/server/data/auth';

import { onboardedDestination, signInReturnUrl, withNext } from '@/lib/lighthouse';

/** Decides where a signed-in user lands: onboarding, the terms, the dapp (or its page in `next`), or, via the pass route, the Lighthouse page in `next`. */
export async function GET(request: NextRequest) {
  const next = signInReturnUrl(request.nextUrl.searchParams.get('next'));
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // The session is gone: sign in again, keeping the way back.
  const { user } = await getUser();
  if (!user) return redirectTo(withNext('/sign-in', next));

  // Onboarding and the terms keep the way back and hand the user on once they finish.
  const requiredStep = await getRequiredStep(user.id);
  if (requiredStep) return redirectTo(withNext(requiredStep, next));

  return redirectTo(onboardedDestination(next));
}
