import { describe, expect, it } from 'vitest';

import { googleVouchesFor } from './google-email';

describe('googleVouchesFor', () => {
  it.each([
    ['a verified Gmail address', { email: 'ana@gmail.com', email_verified: true }, true],
    ['a verified googlemail address, any case', { email: 'Ana@GoogleMail.com', email_verified: true }, true],
    ['a verified Workspace address', { email: 'ana@zivoe.com', email_verified: true, hd: 'zivoe.com' }, true],
    ['a verified address Google does not host', { email: 'ana@company.com', email_verified: true }, false],
    ['an unverified Gmail address', { email: 'ana@gmail.com', email_verified: false }, false],
    [
      'a Workspace domain whose address is unverified',
      { email: 'ana@zivoe.com', email_verified: false, hd: 'zivoe.com' },
      false
    ],
    ['a lookalike domain', { email: 'ana@gmail.com.evil.test', email_verified: true }, false],
    ['no verification claim at all', { email: 'ana@gmail.com' }, false]
  ])('%s', (_, profile, vouches) => {
    expect(googleVouchesFor(profile)).toBe(vouches);
  });
});
