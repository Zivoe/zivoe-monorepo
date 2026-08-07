// Structural views of the SDK entities this module consumes — keeps SDK types
// out of signatures and lets tests fake the client boundary with plain objects.
import { type TransactionReceipt } from 'viem';

export type BalanceLike = {
  toBigInt(): bigint;
  decimals: number;
};

export type TransactionStatusLike = {
  type: string;
  hash?: string;
  receipt?: TransactionReceipt;
};

/**
 * The real SDK Transaction is also a PromiseLike whose `then` runs the whole
 * transaction to completion (lastValueFrom). Never let one cross an `await`
 * bare — pass it wrapped (see CentrifugeTxConfig's `{ tx }` contract) and
 * consume statuses only through `subscribe`.
 */
export type TransactionEntity = {
  subscribe(observer: {
    next: (status: TransactionStatusLike) => void;
    error: (error: unknown) => void;
    complete: () => void;
  }): { unsubscribe(): void };
};

export type VaultEntity = {
  /** The vault's contract address — asserted against the configured one at resolution. */
  address: `0x${string}`;
  details(): PromiseLike<{ maxDeposit: BalanceLike; isSyncDeposit: boolean; isSyncRedeem: boolean }>;
  investment(investor: `0x${string}`): PromiseLike<{
    pendingRedeemShares: BalanceLike;
    claimableRedeemAssets: BalanceLike;
    claimableRedeemSharesEquivalent: BalanceLike;
    claimableCancelRedeemShares: BalanceLike;
    hasPendingCancelRedeemRequest: boolean;
  }>;
  syncDeposit(amount: BalanceLike): TransactionEntity;
  asyncRedeem(sharesAmount: BalanceLike): TransactionEntity;
  /** Cancels the full remaining pending redeem amount — no partial decrease exists. */
  cancelRedeemRequest(): TransactionEntity;
  /**
   * Claims exactly one bucket per transaction, in the SDK's fixed priority:
   * Returned Shares before redemption USDC.
   */
  claim(): TransactionEntity;
};
