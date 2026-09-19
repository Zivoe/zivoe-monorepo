import { describe, expect, it } from 'vitest';

import { LIGHTHOUSE_URL, lighthouseReturnUrl, withNext } from './lighthouse';

describe('lighthouseReturnUrl', () => {
  it('returns a Lighthouse page without its query or fragment', () => {
    expect(lighthouseReturnUrl(`${LIGHTHOUSE_URL}/`)).toBe(`${LIGHTHOUSE_URL}/`);
    expect(lighthouseReturnUrl(`${LIGHTHOUSE_URL}/positions/north-star?tab=1#top`)).toBe(
      `${LIGHTHOUSE_URL}/positions/north-star`
    );
  });

  it('rejects everything that is not a Lighthouse page, so `next` cannot be an open redirect', () => {
    for (const next of [
      undefined,
      null,
      '',
      '/liquidity',
      '//evil.example',
      'javascript:alert(1)',
      'https://evil.example/liquidity',
      `${LIGHTHOUSE_URL}.evil.example/`,
      `${LIGHTHOUSE_URL}@evil.example/`,
      `${LIGHTHOUSE_URL}/positions/(x)`,
      `${LIGHTHOUSE_URL}//evil.example`,
      [`${LIGHTHOUSE_URL}/`]
    ])
      expect(lighthouseReturnUrl(next)).toBeUndefined();
  });

  it('stays within what better-auth accepts as a relative social sign-in callbackURL', () => {
    // better-auth 1.4 matchesOriginPattern: a callbackURL outside this pattern fails social sign-in with a 403.
    const relativeCallbackURL = /^\/(?!\/|\\|%2f|%5c)[\w\-.\+/@]*(?:\?[\w\-.\+/=&%@]*)?$/;
    const next = lighthouseReturnUrl(`${LIGHTHOUSE_URL}/positions/North_Star.v2`);

    expect(withNext('/api/auth/post-signin', next)).toMatch(relativeCallbackURL);
  });
});
