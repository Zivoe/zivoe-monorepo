import { describe, expect, it } from 'vitest';

import { countRedemptionRequests } from '@/centrifuge/redemption-states';
import { type RedemptionPosition } from '@/centrifuge/types';
import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { type ReadState, buildPortfolio, portfolioTokens, positionKey, tokenKey } from './model';

const D18 = 10n ** 18n;
const empty: RedemptionPosition = {
  pendingRedeemShares: 0n,
  claimableRedeemAssets: 0n,
  claimableRedeemSharesEquivalent: 0n,
  unfundedClaimableAssets: 0n,
  claimableCancelRedeemShares: 0n,
  hasPendingCancelRedeemRequest: false
};
const success = <T>(data: T): ReadState<T> => ({ data, isError: false, isPending: false });
const first = FIXTURE_IDENTITY;
const second = identityOnChain(first, 'base-sepolia', { asset: { ...first.centrifugeVault.asset, decimals: 18 } });
const usdt = identityOnChain(first, 'sepolia', {
  address: '0x1111111111111111111111111111111111111111',
  asset: {
    ...first.centrifugeVault.asset,
    address: '0x2222222222222222222222222222222222222222',
    symbol: 'USDT',
    decimals: 6
  }
});
const identities = [first, second, usdt];
function inputs() {
  return {
    identities,
    balances: new Map(
      portfolioTokens(identities).map((token) => [tokenKey(token), success(10n * 10n ** BigInt(token.decimals))])
    ),
    positions: new Map(identities.map((identity) => [positionKey(identity), success(empty)])),
    sharePrice: success(2n * D18)
  };
}

describe('portfolio valuation', () => {
  it('deduplicates wallet token references but preserves each payout vault; reconciles mixed decimals', () => {
    const data = inputs();
    data.positions.set(
      positionKey(first),
      success({
        ...empty,
        pendingRedeemShares: 3n * 10n ** 8n,
        claimableCancelRedeemShares: 10n ** 8n,
        claimableRedeemAssets: 4_000_000n,
        claimableRedeemSharesEquivalent: 999n * D18
      })
    );
    data.positions.set(positionKey(usdt), success({ ...empty, unfundedClaimableAssets: 2_000_000n }));
    const model = buildPortfolio({ ...data, identities: [...identities, first] });
    expect(portfolioTokens(identities)).toHaveLength(5);
    expect(model.totalD18).toBe(84n * D18); // 24 shares * $2 + $24 USDC + $12 USDT
    expect(model.subtotals).toEqual({ available: 70n * D18, pending: 8n * D18, claimable: 6n * D18 });
    expect(model.holdings.reduce((sum, row) => sum + (row.valueD18 ?? 0n), 0n)).toBe(model.totalD18);
    expect(model.holdings.reduce((sum, row) => sum + (row.sharePercent ?? 0), 0)).toBeCloseTo(100, 1);
    expect(model.holdings[3]).toMatchObject({ asset: 'USD1', supported: false, valueD18: null, sharePercent: null });
    expect(model.requests).toHaveLength(4);
  });
  it('keeps every active state including a zero-share cancellation', () => {
    const data = inputs();
    const split = {
      ...empty,
      pendingRedeemShares: 1n,
      hasPendingCancelRedeemRequest: true,
      claimableCancelRedeemShares: 2n,
      claimableRedeemAssets: 3n
    };
    data.positions.set(positionKey(first), success(split));
    data.positions.set(
      positionKey(usdt),
      success({ ...empty, hasPendingCancelRedeemRequest: true, unfundedClaimableAssets: 1n })
    );
    const result = buildPortfolio(data);
    expect(result.requests.map((request) => request.kind)).toEqual([
      'returned',
      'claimable',
      'cancelling',
      'unfunded',
      'cancelling'
    ]);
    expect(countRedemptionRequests(split)).toBe(3);
    expect(result.requests).toHaveLength(5);
  });
  it('retains stale positions and loaded balances but withholds incomplete totals and percentages', () => {
    const data = inputs();
    data.positions.set(positionKey(first), {
      data: { ...empty, pendingRedeemShares: 1n },
      isError: true,
      isPending: false
    });
    const result = buildPortfolio(data);
    expect(result.totalD18).toBeNull();
    expect(result.holdings.every((row) => row.sharePercent === null)).toBe(true);
    expect(result.requests[0]?.stale).toBe(true);
    expect(result.requestsComplete).toBe(false);
    expect(result.failedChains).toEqual(['sepolia']);
    expect(result.holdings[0]?.chains.find((chain) => chain.chain === 'base-sepolia')?.available).toBe(10n * D18);
  });
  it('only confirms an empty requests panel after every position succeeds', () => {
    const data = inputs();
    data.positions.set(positionKey(second), { isError: false, isPending: true });
    expect(buildPortfolio(data)).toMatchObject({
      requests: [],
      requestsComplete: false,
      totalD18: null,
      pendingChains: ['base-sepolia']
    });
    data.positions.set(positionKey(second), success(empty));
    expect(buildPortfolio(data)).toMatchObject({ requests: [], requestsComplete: true, complete: true });
  });
  it('does not price an unknown payout asset or an unavailable share price at $1', () => {
    const eurc = identityOnChain(first, 'base-sepolia', { asset: { ...first.centrifugeVault.asset, symbol: 'EURC' } });
    const data = inputs();
    data.identities = [eurc];
    data.positions.set(positionKey(eurc), success({ ...empty, claimableRedeemAssets: 1_000_000n }));
    const result = buildPortfolio(data);
    expect(result.unpricedAssets).toEqual(['EURC']);
    expect(result.requests[0]?.valueD18).toBeNull();
    expect(result.totalD18).toBeNull();
    expect(buildPortfolio({ ...inputs(), sharePrice: { isError: true, isPending: false } }).totalD18).toBeNull();
  });
});
