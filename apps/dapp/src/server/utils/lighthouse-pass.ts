import 'server-only';

import { createHmac } from 'node:crypto';

import { BASE_URL } from './base-url';

// The Lighthouse pass: a signed cookie that lets its holder view Lighthouse (lib/lighthouse.ts) for
// 24 hours. `/api/lighthouse/pass` issues it and sign-out clears it. Lighthouse verifies it on its
// own with the shared LIGHTHOUSE_PASS_SECRET (its src/lib/dapp-access.ts), so the cookie name and
// the format below must stay identical in both apps. It names nobody and grants nothing in the
// dapp, which is why the session cookies stay host-only and the secret is not BETTER_AUTH_SECRET.

const PASS_SECONDS = 24 * 60 * 60;

/**
 * Cookie attributes, shared by issuing and clearing. `Domain=zivoe.com` only when the dapp is served
 * from *.zivoe.com: browsers reject it from localhost or *.vercel.app. On localhost the host-only
 * cookie is shared across ports, which is how a local Lighthouse on :3100 sees it.
 */
export function lighthousePassCookie(origin = BASE_URL) {
  const { protocol, hostname } = new URL(origin);

  return {
    name: 'lighthouse-pass',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: protocol === 'https:',
    ...(hostname.endsWith('.zivoe.com') && { domain: 'zivoe.com' })
  } as const;
}

/** `${exp}.${signature}`: expiry in unix seconds, then the base64url HMAC-SHA256 of `lighthouse-pass-v1.${exp}`. */
export function createLighthousePass({ secret, now = Date.now() }: { secret: string; now?: number }) {
  const exp = Math.floor(now / 1000) + PASS_SECONDS;
  const signature = createHmac('sha256', secret).update(`lighthouse-pass-v1.${exp}`).digest('base64url');

  return { value: `${exp}.${signature}`, maxAge: PASS_SECONDS };
}
