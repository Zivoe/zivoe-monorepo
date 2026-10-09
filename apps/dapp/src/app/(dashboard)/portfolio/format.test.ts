import { describe, expect, it } from 'vitest';

import { axisTickLabel, balanceChangeLine, balanceChartSubtitle, failedReadsLabel } from './format';

const D18 = 10n ** 18n;

describe('balanceChartSubtitle', () => {
  it('names what the chart leaves out, so it reconciles with the hero', () => {
    expect(balanceChartSubtitle({ shareSymbol: 'zSMB', shareAmounts: undefined })).toBe('in your wallet');
    expect(
      balanceChartSubtitle({
        shareSymbol: 'zSMB',
        shareAmounts: { wallet: 2n * D18, inRedemption: 0n, readyToClaim: 0n }
      })
    ).toBe('in your wallet');
    expect(
      balanceChartSubtitle({
        shareSymbol: 'zSMB',
        shareAmounts: { wallet: 2n * D18, inRedemption: (87n * D18) / 100n, readyToClaim: 0n }
      })
    ).toBe('in your wallet, excluding 0.87 zSMB in redemption');
    expect(
      balanceChartSubtitle({
        shareSymbol: 'zSMB',
        shareAmounts: { wallet: 0n, inRedemption: (87n * D18) / 100n, readyToClaim: D18 / 4n }
      })
    ).toBe('in your wallet, excluding 0.87 zSMB in redemption and 0.25 zSMB ready to claim');
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

describe('balanceChangeLine', () => {
  it('signs the figure like a ticker and names the range', () => {
    expect(balanceChangeLine({ change: { deltaD18: (1240n * D18) / 100n, percent: 1.03 }, range: '30D' })).toEqual({
      figure: '+$12.40 (+1.03%)',
      caption: 'past 30 days'
    });
    expect(balanceChangeLine({ change: { deltaD18: -5n * D18, percent: -5 }, range: '1Y' })).toEqual({
      figure: '-$5.00 (-5.00%)',
      caption: 'past year'
    });
    expect(balanceChangeLine({ change: { deltaD18: 0n, percent: 0 }, range: '7D' })).toEqual({
      figure: '$0.00 (0.00%)',
      caption: 'past 7 days'
    });
    // No percent off a zero base: the wallet was empty at the start of the range.
    expect(balanceChangeLine({ change: { deltaD18: 4n * D18 }, range: 'All' })).toEqual({
      figure: '+$4.00',
      caption: 'all time'
    });
    // A small wallet's week of yield is under a cent: said so, never "$0.00" beside a live percent.
    expect(balanceChangeLine({ change: { deltaD18: D18 / 250n, percent: 0.12 }, range: '7D' })).toEqual({
      figure: '<$0.01 (+0.12%)',
      caption: 'past 7 days'
    });
  });
});

describe('axisTickLabel', () => {
  it('prints the whole figure so neighbouring gridlines never share a label', () => {
    expect(axisTickLabel({ value: 1_140_500, step: 500 })).toBe('1,140,500');
    expect(axisTickLabel({ value: 45_125, step: 25 })).toBe('45,125');
    expect(axisTickLabel({ value: 3.2, step: 0.1 })).toBe('3.20');
    expect(axisTickLabel({ value: 0.125, step: 0.025 })).toBe('0.125');
  });
});
