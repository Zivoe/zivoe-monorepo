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
  details(): PromiseLike<{ maxDeposit: BalanceLike }>;
  investment(investor: `0x${string}`): PromiseLike<{
    pendingRedeemShares: BalanceLike;
    claimableRedeemAssets: BalanceLike;
    claimableRedeemSharesEquivalent: BalanceLike;
  }>;
  syncDeposit(amount: BalanceLike): TransactionEntity;
  asyncRedeem(sharesAmount: BalanceLike): TransactionEntity;
  /** Aggregate claim: one transaction collects all currently claimable funds. */
  claim(): TransactionEntity;
};
