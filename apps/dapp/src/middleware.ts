import { type NextRequest, NextResponse } from 'next/server';

import { getSessionCookie } from 'better-auth/cookies';

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL('/sign-in', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - sign-in (public auth page)
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!sign-in|api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
  ]
};
