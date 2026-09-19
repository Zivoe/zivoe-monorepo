import { type NextRequest, NextResponse } from 'next/server';

import { getUser, isUserOnboarded } from '@/server/data/auth';
import { createLighthousePass, lighthousePassCookie } from '@/server/utils/lighthouse-pass';

import { LIGHTHOUSE_URL, lighthouseReturnUrl, withNext } from '@/lib/lighthouse';

import { env } from '@/env';

const noStore = { 'Cache-Control': 'private, no-store' };

/**
 * Where Lighthouse sends every visitor without a valid pass, and the only place a pass is issued:
 * a signed-in, onboarded user gets one and returns to the Lighthouse page in `next`. A signed-out
 * visitor goes to sign-in first, which leads back here; one who has not onboarded goes to onboarding
 * and stays in the dapp afterwards. `/api/*` is outside the proxy matcher,
 * so signed-out visitors reach this route and it has to handle them itself.
 */
export async function GET(request: NextRequest) {
  // Without the secret no pass can be issued, and sending the visitor on would bounce them between the two apps.
  const secret = env.LIGHTHOUSE_PASS_SECRET;
  if (!secret) return new NextResponse('Lighthouse access is not configured.', { status: 503, headers: noStore });

  const next = lighthouseReturnUrl(request.nextUrl.searchParams.get('next')) ?? `${LIGHTHOUSE_URL}/`;

  // react's cache() does not dedupe outside a render, so read the session exactly once per request.
  const { user } = await getUser();
  const isOnboarded = !!user && (await isUserOnboarded(user.id));

  if (!isOnboarded) {
    // Sign-in brings the visitor back here; onboarding does not, it leaves them in the dapp.
    const detour = user ? '/onboarding' : withNext('/sign-in', next);
    return NextResponse.redirect(new URL(detour, request.url), { headers: noStore });
  }

  // The flag tells Lighthouse this visit follows a fresh pass: if the pass still does not verify there (cookie
  // Domain wrong, secrets mismatched) it shows a static page instead of sending the visitor back here forever.
  const destination = new URL(next);
  destination.searchParams.set('pass', '1');

  const response = NextResponse.redirect(destination, { headers: noStore });
  response.cookies.set({ ...lighthousePassCookie(), ...createLighthousePass({ secret }) });

  return response;
}
