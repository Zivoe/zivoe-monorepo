import { render } from '@react-email/components';
import { describe, expect, it, vi } from 'vitest';

import { buildTransactionReceiptEmail } from './centrifuge-tx-receipt-email';
import { type TransactionReceiptJob } from './centrifuge-tx-receipt-job';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const UNSUBSCRIBE_URL = 'https://app.test/unsubscribe?token=t';
const VIEW_IN_APP_URL = 'https://app.test/vaults/zsmb';

function job(overrides: Partial<TransactionReceiptJob['event']> = {}): TransactionReceiptJob {
  return {
    eventId: '0xsc:1:0xtx:SYNC_DEPOSIT:0xabc',
    userId: '3f1f9a5e-53a5-4bb5-9129-c1c1f6a4a111',
    vaultSlug: 'zsmb',
    shareClassKey: 'zsmb',
    event: {
      type: 'SYNC_DEPOSIT',
      account: '0xb8da328a4edb64af841c6bb72b55988e9abeb172',
      txHash: '0xccdab4d1b295d7a91f437ae2d9840b914cc8b94009c4edae1b44284f68cc619e',
      chainId: 1,
      chainName: 'ethereum',
      explorerUrl: 'https://etherscan.io',
      centrifugeId: '1',
      tokenAmount: 4405778757590310318n,
      currencyAmount: 5000000n,
      createdAtMs: 1786000000000,
      ...overrides
    }
  };
}

function build(overrides: Partial<TransactionReceiptJob['event']> = {}) {
  return buildTransactionReceiptEmail({
    job: job(overrides),
    symbol: 'zSMB',
    shareDecimals: 18,
    viewInAppUrl: VIEW_IN_APP_URL,
    unsubscribeUrl: UNSUBSCRIBE_URL
  });
}

describe('buildTransactionReceiptEmail', () => {
  it('deposit: receipt with both amounts, explorer links, network, unsubscribe, and the app CTA', async () => {
    const { subject, email } = build();
    const html = await render(email);

    expect(subject).toBe('Deposit Confirmed');
    expect(html).toContain('Deposit Receipt');
    expect(html).toContain('5.00 USDC');
    expect(html).toContain('4.40'); // zSMB side of the flow (nbsp separates value and symbol)
    expect(html).toContain('https://etherscan.io/tx/0xccdab4d1');
    expect(html).toContain('https://etherscan.io/address/0xb8da328a');
    expect(html).toContain('0xb8da...b172');
    // The app's chain registry wins over the indexer's internal name.
    expect(html).toContain('Ethereum');
    expect(html).toContain(VIEW_IN_APP_URL);
    expect(html).toContain(UNSUBSCRIBE_URL);
  });

  it('redemption request: names only the shares this call added', async () => {
    const { subject, email } = build({ type: 'REDEEM_REQUEST_UPDATED', currencyAmount: null });
    const html = await render(email);

    expect(subject).toBe('Redemption Request Received');
    expect(html).toContain('Amount Requested');
    expect(html).toContain('ready to');
    expect(html).not.toContain('USDC');
  });

  it('claimable: claim CTA and the amounts of this fill', async () => {
    const { subject, email } = build({ type: 'REDEEM_CLAIMABLE' });
    const html = await render(email);

    expect(subject).toBe('Your Redemption Is Ready to Claim');
    expect(html).toContain('Claim in App');
    // The token-flow row joins value and symbol with a non-breaking space.
    expect(html).toContain('5.00\u00A0USDC');
    expect(html).toContain(VIEW_IN_APP_URL);
  });

  it('claimed: redemption receipt without a fee row', async () => {
    const { subject, email } = build({ type: 'REDEEM_CLAIMED' });
    const html = await render(email);

    expect(subject).toBe('Redemption Complete');
    expect(html).toContain('Redemption Receipt');
    expect(html).toContain('Amount Redeemed');
    expect(html).not.toContain('Fee');
  });

  it('no usable explorer: hash and address render as plain truncated text', async () => {
    const { email } = build({ chainId: null, chainName: 'pharos', explorerUrl: null });
    const html = await render(email);

    expect(html).toContain('0xccda...619e');
    expect(html).not.toContain('/tx/0xccdab4d1');
    expect(html).toContain('pharos');
  });

  it('absent amounts render as a dash, never as NaN or zero', async () => {
    const { email } = build({ tokenAmount: null, currencyAmount: null });
    const html = await render(email);

    expect(html).toContain('—');
    expect(html).not.toContain('NaN');
  });
});
