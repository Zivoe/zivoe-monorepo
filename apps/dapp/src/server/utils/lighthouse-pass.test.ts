import { describe, expect, it } from 'vitest';

import { createLighthousePass, lighthousePassCookie } from './lighthouse-pass';

describe('createLighthousePass', () => {
  it('matches the test vector Lighthouse verifies (its tests/unit/dapp-access.test.ts), so the two cannot drift', () => {
    const exp = 2_000_000_000;
    const pass = createLighthousePass({
      secret: 'lighthouse-pass-test-vector-secret-32ch',
      now: (exp - 24 * 60 * 60) * 1000
    });

    expect(pass).toEqual({ value: '2000000000.kbYHBzPIW4Pdnc8Q0j5RLu2oJ-7IZ9BJITbU2raiNoE', maxAge: 86_400 });
  });
});

describe('lighthousePassCookie', () => {
  it('is shared on zivoe.com only when the dapp is served from there, and Secure only over https', () => {
    expect(lighthousePassCookie('https://app.zivoe.com')).toEqual({
      name: 'lighthouse-pass',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: true,
      domain: 'zivoe.com'
    });

    for (const origin of ['https://dapp-git-feature.vercel.app', 'https://notzivoe.com', 'http://localhost:3000']) {
      const cookie = lighthousePassCookie(origin);

      expect(cookie).not.toHaveProperty('domain');
      expect(cookie.secure).toBe(origin.startsWith('https'));
    }
  });
});
