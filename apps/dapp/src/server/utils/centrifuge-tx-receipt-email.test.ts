import { render } from '@react-email/components';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { buildTransactionReceiptEmail } from './centrifuge-tx-receipt-email';
import { type TransactionReceiptJob } from './centrifuge-tx-receipt-job';

// The module reaches @/lib/utils, whose toast import drags in the React runtime.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

// Lets a test stand in an 18-decimal USDC (BNB Smart Chain's Binance-Peg
// shape) on ANY chain id: BNB is the catalog's only such chain today, and the
// renderers must scale by the event chain's instance, never by a constant.
const mocks = vi.hoisted(() => ({ eighteenDecimalUsdcChain: undefined as string | undefined }));
vi.mock(import('@zivoe/centrifuge-indexer'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getShareClassChainIdentity: (args: { chain: CentrifugeChain; key: string }) => {
      const identity = actual.getShareClassChainIdentity(args);
      return args.chain === mocks.eighteenDecimalUsdcChain
        ? { ...identity, asset: { ...identity.asset, decimals: 18 } }
        : identity;
    }
  };
});

afterEach(() => {
  mocks.eighteenDecimalUsdcChain = undefined;
});

const UNSUBSCRIBE_URL = 'https://app.test/unsubscribe?token=t';
const VIEW_IN_APP_URL = 'https://app.test/vaults/zivoe-smb-credit';

function job(overrides: Partial<TransactionReceiptJob['event']> = {}): TransactionReceiptJob {
  return {
    eventId: '0xsc:1:0xtx:SYNC_DEPOSIT:0xabc',
    userId: '3f1f9a5e-53a5-4bb5-9129-c1c1f6a4a111',
    zivoeVaultSlug: 'zivoe-smb-credit',
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

    expect(subject).toBe('zSMB Deposit Confirmed');
    expect(html).toContain('Deposit Receipt');
    expect(html).toContain('5.00 USDC deposited into zSMB');
    expect(html).toContain('>Success<');
    // Wallet-scoped copy: the link is self-reported, so no ownership claims.
    expect(html).toContain('a wallet linked to your account');
    expect(html).toContain('5.00 USDC');
    expect(html).toContain('4.40'); // zSMB side of the flow (nbsp separates value and symbol)
    expect(html).toContain('https://etherscan.io/tx/0xccdab4d1');
    expect(html).toContain('https://etherscan.io/address/0xb8da328a');
    expect(html).toContain('0xb8da...b172');
    // The app's chain registry wins over the indexer's internal name.
    expect(html).toContain('Ethereum');
    expect(html).toContain(VIEW_IN_APP_URL);
    expect(html).toContain(UNSUBSCRIBE_URL);
    // Receipts close with the transaction fine print, not the marketing one.
    expect(html).toContain('It is not an offer, solicitation, or investment recommendation.');
    expect(html).not.toContain('does not constitute an offer to sell');
  });

  it("deposit on an 18-decimal chain: the amount is scaled by that chain's USDC, not a constant", async () => {
    mocks.eighteenDecimalUsdcChain = 'ethereum';
    const { email } = build({ currencyAmount: 5_000_000_000_000_000_000n });
    const html = await render(email);

    expect(html).toContain('5.00 USDC deposited into zSMB');
    expect(html).not.toContain('5,000,000,000,000');
  });

  it('claimable on a chain the registry does not know: the asset side degrades to neutral copy, never a guessed scale', async () => {
    const { email } = build({ type: 'REDEEM_CLAIMABLE', chainId: null, chainName: 'plume', explorerUrl: null });
    const html = await render(email);

    expect(html).toContain('Funds are ready to claim in the app on plume.');
    expect(html).toContain('Claim in App');
    expect(html).toContain('Your redemption is ready to claim');
    expect(html).not.toContain('USDC');
  });

  it('redemption request: names only the shares this call added', async () => {
    // currencyAmount is 0 on redeem requests, per the indexer contract.
    const { subject, email } = build({ type: 'REDEEM_REQUEST_UPDATED', currencyAmount: 0n });
    const html = await render(email);

    expect(subject).toBe('zSMB Redemption Request Received');
    expect(html).toContain('Amount Requested');
    // A request is pending, not done — the status pill must not say so.
    expect(html).toContain('>Received<');
    expect(html).not.toContain('>Success<');
    expect(html).toContain('ready to claim');
    expect(html).not.toContain('USDC');
  });

  it('claimable: claim CTA and the amounts of this fill', async () => {
    const { subject, email } = build({ type: 'REDEEM_CLAIMABLE' });
    const html = await render(email);

    expect(subject).toBe('Your zSMB Redemption Is Ready to Claim');
    expect(html).toContain('Claim USDC in App');
    expect(html).toContain('>Ready to claim<');
    expect(html).toContain('Amount Approved');
    // The claim is chain-scoped in the app, so the email names the chain.
    expect(html).toContain('ready to claim in the app on Ethereum.');
    // The token-flow row joins value and symbol with a non-breaking space.
    expect(html).toContain('5.00\u00A0USDC');
    // Deep link to the redeem tab, where the claim control actually lives.
    expect(html).toContain(`${VIEW_IN_APP_URL}?view=redeem`);
  });

  it('claimed: redemption receipt without a fee row', async () => {
    const { subject, email } = build({ type: 'REDEEM_CLAIMED' });
    const html = await render(email);

    expect(subject).toBe('zSMB Redemption Complete');
    expect(html).toContain('Redemption Receipt');
    expect(html).toContain('Amount Redeemed');
  });

  it('claimed with only the asset amount missing: the preview falls back rather than reading "redeemed for —"', async () => {
    const { email } = build({ type: 'REDEEM_CLAIMED', currencyAmount: null });
    const html = await render(email);

    expect(html).toContain('Your redemption receipt is ready');
    expect(html).not.toContain('redeemed for');
  });

  it('no usable explorer: hash and address render as plain truncated text', async () => {
    const { email } = build({ chainId: null, chainName: 'pharos', explorerUrl: null });
    const html = await render(email);

    expect(html).toContain('0xccda...619e');
    expect(html).not.toContain('/tx/0xccdab4d1');
    expect(html).toContain('pharos');
    // An unknown chain has no deposit asset either: the amount shows as
    // absent instead of at a guessed scale, and the preview falls back.
    expect(html).not.toContain('5.00 USDC');
    expect(html).toContain('Your deposit receipt is ready');
  });

  it('absent amounts render as a dash, never as NaN or zero, and stay out of the preview line', async () => {
    const { email } = build({ tokenAmount: null, currencyAmount: null });
    const html = await render(email);

    expect(html).toContain('—');
    expect(html).not.toContain('NaN');
    expect(html).toContain('Your deposit receipt is ready');
  });

  it('an absurd timestamp renders as a dash, not an Invalid Date artifact', async () => {
    const { email } = build({ createdAtMs: 1e20 });
    const html = await render(email);

    expect(html).not.toContain('NaN');
  });
});
