import { describe, expect, it } from 'vitest';

import { type WalletActivity } from '@zivoe/centrifuge-indexer';

import { groupPortfolioActivity } from './activity';

const deposit: WalletActivity = {
  type: 'SYNC_DEPOSIT',
  chainId: 1,
  centrifugeId: '1',
  txHash: '0xabc',
  tokenAmount: 800n,
  currencyAmount: 1000n,
  assetAddress: '0xusdc',
  timestampMs: 1000,
  block: 1,
  fromAccount: null,
  toAccount: null
};
const received: WalletActivity = { ...deposit, type: 'TRANSFER_IN', currencyAmount: null, assetAddress: null };

describe('portfolio activity grouping', () => {
  it('deduplicates overlapping pages and combines an exact deposit share leg', () => {
    expect(groupPortfolioActivity([received, deposit, { ...received, txHash: '0xABC' }])).toEqual([deposit]);
    expect(groupPortfolioActivity([received, deposit], true)).toEqual([]);
  });
  it('preserves different transactions, chains, amounts and bridge legs', () => {
    for (const transfer of [
      { ...received, txHash: '0xother' },
      { ...received, chainId: 8453, centrifugeId: '6' },
      { ...received, tokenAmount: 801n },
      { ...received, fromCentrifugeId: '1', toCentrifugeId: '6' },
      { ...received, transferMessageId: '0xmessage' },
      { ...received, transferLeg: 'IN' as const }
    ])
      expect(groupPortfolioActivity([deposit, transfer])).toHaveLength(2);
  });
  it('combines an exact completed redemption but retains approval and request states', () => {
    const redeemed: WalletActivity = { ...deposit, type: 'REDEEM_CLAIMED' };
    const sent: WalletActivity = { ...received, type: 'TRANSFER_OUT' };
    expect(groupPortfolioActivity([redeemed, sent])).toEqual([redeemed]);
    for (const type of ['REDEEM_CLAIMABLE', 'REDEEM_REQUEST_UPDATED'] as const)
      expect(groupPortfolioActivity([{ ...redeemed, type }, sent])).toHaveLength(2);
  });
  it('keeps ambiguous and incomplete conversions separate', () => {
    expect(groupPortfolioActivity([deposit, { ...deposit, type: 'DEPOSIT_CLAIMED' }, received])).toHaveLength(3);
    expect(groupPortfolioActivity([{ ...deposit, currencyAmount: null }, received])).toHaveLength(2);
    expect(
      groupPortfolioActivity([
        { ...deposit, chainId: null },
        { ...received, chainId: null }
      ])
    ).toHaveLength(2);
  });
});
