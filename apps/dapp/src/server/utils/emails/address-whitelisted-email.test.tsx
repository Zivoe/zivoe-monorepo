// @vitest-environment jsdom
import { render } from '@react-email/components';
import { describe, expect, it } from 'vitest';

import AddressWhitelistedEmail from './address-whitelisted-email';

const VAULTS_URL = 'https://app.zivoe.com/';

describe('the address whitelisted email', () => {
  it('names the address short and sends the reader to the vaults with no token', async () => {
    const html = await render(
      AddressWhitelistedEmail({
        name: 'Ada',
        address: '0x881500000000000000000000000000000000e9e6',
        vaultsUrl: VAULTS_URL
      })
    );

    expect(html).toContain('0x8815...e9e6');
    expect(html).toContain(`href="${VAULTS_URL}"`);
    expect(html).toContain('Open the vaults');
    // Transactional: no unsubscribe link and no marketing disclosure.
    expect(html).not.toMatch(/unsubscribe/i);
    expect(html).not.toMatch(/token=/);
  });
});
