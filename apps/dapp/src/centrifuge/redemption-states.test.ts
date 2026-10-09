import { describe, expect, it } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import {
  countRedemptionRequests,
  describeRedemptionState,
  redemptionStates,
  summarizeRedemptionState
} from './redemption-states';
import { type RedemptionPosition } from './types';

const EMPTY: RedemptionPosition = {
  pendingRedeemShares: 0n,
  claimableRedeemAssets: 0n,
  claimableRedeemSharesEquivalent: 0n,
  unfundedClaimableAssets: 0n,
  claimableCancelRedeemShares: 0n,
  hasPendingCancelRedeemRequest: false
};

// The fixture class has 8 share decimals and a 6-decimal USDC asset.
const vault = FIXTURE_IDENTITY.centrifugeVault;

describe('redemptionStates', () => {
  it('is empty for no position and for an empty one', () => {
    expect(redemptionStates(undefined)).toEqual([]);
    expect(redemptionStates(EMPTY)).toEqual([]);
    expect(countRedemptionRequests(EMPTY)).toBe(0);
  });

  it('lists a partial fill as every state it is in, in strip order', () => {
    const states = redemptionStates({
      ...EMPTY,
      claimableCancelRedeemShares: 1n,
      claimableRedeemAssets: 2n,
      unfundedClaimableAssets: 3n,
      pendingRedeemShares: 4n
    });

    expect(states.map((state) => state.kind)).toEqual(['returned', 'claimable', 'unfunded', 'processing']);
    expect(countRedemptionRequests({ ...EMPTY, pendingRedeemShares: 4n })).toBe(1);
  });

  it('reads a pending cancellation as cancelling, even with no shares left pending', () => {
    expect(redemptionStates({ ...EMPTY, hasPendingCancelRedeemRequest: true })).toEqual([
      { kind: 'cancelling', shares: 0n }
    ]);
    expect(redemptionStates({ ...EMPTY, hasPendingCancelRedeemRequest: true, pendingRedeemShares: 5n })).toEqual([
      { kind: 'cancelling', shares: 5n }
    ]);
  });
});

describe('describeRedemptionState', () => {
  it('prints each state the way the Pending tab does', () => {
    const describe = (state: Parameters<typeof describeRedemptionState>[0]['state'], sharePrice?: bigint) =>
      describeRedemptionState({ state, centrifugeVault: vault, sharePrice });

    expect(describe({ kind: 'returned', shares: 150_000_000n })).toBe('1.50 zFIX returned from cancellation');
    expect(describe({ kind: 'claimable', assets: 1_250_500_000n })).toBe('1,250.50 USDC ready to claim');
    expect(describe({ kind: 'unfunded', assets: 568_775n })).toBe('0.56 USDC approved, awaiting liquidity on Ethereum');
    expect(describe({ kind: 'cancelling', shares: 0n })).toBe('Cancelling redemption request');
    expect(describe({ kind: 'cancelling', shares: 24_000_000n })).toBe('Cancelling redemption request for 0.24 zFIX');
    expect(describe({ kind: 'processing', shares: 100_000_000n })).toBe('1.00 zFIX processing');
    // 1 share at a 1.14 price: the indicative payout in the 6-decimal asset.
    expect(describe({ kind: 'processing', shares: 100_000_000n }, 1_140_000_000_000_000_000n)).toBe(
      '1.00 zFIX processing · ≈ 1.14 USDC'
    );
  });
});

describe('summarizeRedemptionState', () => {
  it('reads each state as a ledger row: amount, status, detail, and whether it is still moving', () => {
    const summarize = (state: Parameters<typeof summarizeRedemptionState>[0]['state'], sharePrice?: bigint) =>
      summarizeRedemptionState({ state, centrifugeVault: vault, sharePrice });

    expect(summarize({ kind: 'returned', shares: 150_000_000n })).toEqual({
      amount: '1.50 zFIX',
      status: 'Returned',
      detail: 'From a cancelled request',
      inMotion: false
    });
    expect(summarize({ kind: 'claimable', assets: 1_250_500_000n })).toEqual({
      amount: '1,250.50 USDC',
      status: 'Ready to claim',
      detail: undefined,
      inMotion: false
    });
    // A blocked wallet's proceeds are approved, never ready: the pill may not contradict a disabled claim.
    expect(
      summarizeRedemptionState({
        state: { kind: 'claimable', assets: 1n },
        centrifugeVault: vault,
        isClaimBlocked: true
      }).status
    ).toBe('Approved');
    expect(summarize({ kind: 'unfunded', assets: 568_775n })).toMatchObject({
      amount: '0.56 USDC',
      status: 'Awaiting liquidity',
      inMotion: true
    });
    // A cancellation with nothing left pending still has a row; it just cannot name an amount.
    expect(summarize({ kind: 'cancelling', shares: 0n })).toMatchObject({
      amount: 'Redemption request',
      status: 'Cancelling'
    });
    expect(summarize({ kind: 'cancelling', shares: 24_000_000n })).toMatchObject({
      amount: '0.24 zFIX',
      inMotion: true
    });
    expect(summarize({ kind: 'processing', shares: 100_000_000n })).toMatchObject({
      amount: '1.00 zFIX',
      status: 'Processing',
      detail: 'Awaiting approval'
    });
    expect(summarize({ kind: 'processing', shares: 100_000_000n }, 1_140_000_000_000_000_000n).detail).toBe(
      '≈ 1.14 USDC on approval'
    );
  });
});
