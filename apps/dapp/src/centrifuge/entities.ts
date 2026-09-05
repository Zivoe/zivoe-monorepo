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

export type CentrifugeVaultEntity = {
  /** The Centrifuge vault's contract address — asserted against the catalog's at resolution. */
  address: `0x${string}`;
  /**
   * The pool the Centrifuge vault serves, for its escrow lookup. `_escrow` is
   * SDK-internal like `_protocolAddresses` (see client.ts): the dependency is
   * version-pinned, and a renamed internal fails the position read at first
   * use — loudly, through the query's error path, never as a silent zero.
   */
  pool: { _escrow(): PromiseLike<string> };
  /**
   * The chain's AsyncRequestManager — where the SDK itself reads the
   * investment struct from. Attached at resolution (see client.ts) so the
   * Unfunded Claim read has it for free.
   */
  asyncRequestManagerAddress: `0x${string}`;
  details(): PromiseLike<{
    maxDeposit: BalanceLike;
  }>;
  investment(investor: `0x${string}`): PromiseLike<{
    /** The Centrifuge vault's own `isPermissioned` answer for this wallet. */
    isAllowedToDeposit: boolean;
    /** The share token's transfer hook, checked against the escrow. */
    isAllowedToRedeem: boolean;
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
