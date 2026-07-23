// Structural views of the SDK entities this module consumes — keeps SDK types
// out of signatures and lets tests fake the client boundary with plain objects.

export type BalanceLike = {
  toBigInt(): bigint;
  decimals: number;
};

export type VaultEntity = {
  details(): PromiseLike<{ maxDeposit: BalanceLike }>;
  investment(investor: `0x${string}`): PromiseLike<{
    shareBalance: BalanceLike;
    pendingRedeemShares: BalanceLike;
    claimableRedeemAssets: BalanceLike;
    claimableRedeemSharesEquivalent: BalanceLike;
  }>;
};
