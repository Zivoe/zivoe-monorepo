import { describe, expect, it } from 'vitest';

import { balanceChartSubtitle, failedReadsLabel } from './format';

const D18 = 10n ** 18n;

describe('balanceChartSubtitle', () => {
  it('names what the chart leaves out, so it reconciles with the hero', () => {
    expect(balanceChartSubtitle({ shareSymbol: 'zSMB', shareAmounts: undefined })).toBe('In your wallet');
    expect(
      balanceChartSubtitle({
        shareSymbol: 'zSMB',
        shareAmounts: { wallet: 2n * D18, inRedemption: 0n, readyToClaim: 0n }
      })
    ).toBe('In your wallet');
    expect(
      balanceChartSubtitle({
        shareSymbol: 'zSMB',
        shareAmounts: { wallet: 2n * D18, inRedemption: (87n * D18) / 100n, readyToClaim: 0n }
      })
    ).toBe('In your wallet, excluding 0.87 zSMB in redemption');
    expect(
      balanceChartSubtitle({
        shareSymbol: 'zSMB',
        shareAmounts: { wallet: 0n, inRedemption: (87n * D18) / 100n, readyToClaim: D18 / 4n }
      })
    ).toBe('In your wallet, excluding 0.87 zSMB in redemption and 0.25 zSMB ready to claim');
  });
});

describe('failedReadsLabel', () => {
  it('names the reads that failed', () => {
    expect(failedReadsLabel({ failedBalanceChains: ['sepolia'], failedPositionChains: [] })).toBe('balances');
    expect(failedReadsLabel({ failedBalanceChains: [], failedPositionChains: ['sepolia'] })).toBe('positions');
    expect(failedReadsLabel({ failedBalanceChains: ['sepolia'], failedPositionChains: ['base-sepolia'] })).toBe(
      'balances and positions'
    );
  });
});
