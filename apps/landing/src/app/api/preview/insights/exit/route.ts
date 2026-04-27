import { draftMode } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

function getSafeRedirectTarget(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('redirect');

  if (!target || target.startsWith('//')) return '/insights';

  try {
    const redirectUrl = new URL(target, request.url);

    if (redirectUrl.origin !== request.nextUrl.origin) return '/insights';

    return `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`;
  } catch {
    return '/insights';
  }
}

export async function GET(request: NextRequest) {
  const draft = await draftMode();
  draft.disable();

  const redirectTo = getSafeRedirectTarget(request);

  return NextResponse.redirect(new URL(redirectTo, request.url));
}
