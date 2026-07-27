export type VaultCapacity = {
  /** Vault-level reserve capacity in USDC base units — never investor-scoped. */
  maxDeposit: bigint;
};

export type DepositPreview = {
  /** zMCA amount in share-token base units, quoted by the vault's own previewDeposit. */
  shares: bigint;
};

export type Investment = {
  pendingRedeemShares: bigint;
  claimableRedeemAssets: bigint;
  claimableRedeemSharesEquivalent: bigint;
  /** Returned Shares: cancelled zMCA waiting for the claim that restores the wallet balance. */
  claimableCancelRedeemShares: bigint;
  /** Cancellation Processing: the position is locked until Centrifuge finishes the unwind. */
  hasPendingCancelRedeemRequest: boolean;
};
