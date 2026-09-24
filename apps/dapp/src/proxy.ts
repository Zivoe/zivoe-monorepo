import { type NextRequest, NextResponse } from 'next/server';

import { getSessionCookie } from 'better-auth/cookies';

import { PERENA_DEMO_PATH } from '@/prototypes/perena/config';
import { isPerenaDemoAllowed } from '@/prototypes/perena/gate';

export function proxy(request: NextRequest) {
  // Refuse before layouts can stream: notFound() inside a streamed page can have HTTP 200.
  if (
    request.nextUrl.pathname.replace(/\/$/, '') === PERENA_DEMO_PATH &&
    !isPerenaDemoAllowed({
      enabled: process.env.PERENA_DEMO_ENABLED,
      nodeEnv: process.env.NODE_ENV,
      publicEnv: process.env.NEXT_PUBLIC_ENV,
      vercel: process.env.VERCEL,
      vercelEnv: process.env.VERCEL_ENV
    })
  ) {
    return new NextResponse('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } });
  }

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
