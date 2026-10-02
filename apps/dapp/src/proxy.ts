import { type NextRequest, NextResponse } from 'next/server';

import { getSessionCookie } from 'better-auth/cookies';

import { isDappReturnPath } from '@/lib/return-paths';

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    const signIn = new URL('/sign-in', request.url);
    // A page an email links to is where the visitor lands once signed in.
    const { pathname } = request.nextUrl;
    if (isDappReturnPath(pathname)) signIn.searchParams.set('next', pathname);
    return NextResponse.redirect(signIn);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - sign-in (public auth page)
     * - unsubscribe (public token-based preference page)
     * - api (API routes)
     * - monitoring (Sentry tunnel route, see next.config.ts `tunnelRoute`)
     * - vd3asd (PostHog reverse proxy)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - static assets (.jpg, .png, .svg, .webp)
     */
    '/((?!sign-in|unsubscribe|api|monitoring|vd3asd|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.jpg|.*\\.png|.*\\.svg|.*\\.webp).*)'
  ]
};
