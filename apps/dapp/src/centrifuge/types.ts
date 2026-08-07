import { type Address } from 'viem';

import { type ShareClassIdentity } from '@zivoe/centrifuge-indexer';

/**
 * The share class a hook transacts and reads against — resolved from the
 * catalog and vault map in the app, a synthetic fixture in tests. Composed
 * from the catalog's identity shape so a new identity field cannot be added
 * in one package and forgotten here, with `key`/`symbol` widened to plain
 * strings on purpose: the module stays a pure, testable boundary with no
 * registry coupling (this import is type-only).
 */
export type TransactedShareClass = Omit<ShareClassIdentity, 'key' | 'symbol'> & {
  /** Share-class id — the identity dimension of caches, query keys and vault memoization. */
  key: string;
  symbol: string;
  vaultAddress: Address;
};

/** Identity a Transaction Hook stamps on copy, analytics, Sentry, and the payload. */
export type TransactionIdentity = {
  /** Offering slug — the stable public identity alongside token symbols. */
  offeringSlug: string;
  shareClass: TransactedShareClass;
};

export type VaultCapacity = {
  /** Vault-level reserve capacity in USDC base units — never investor-scoped. */
  maxDeposit: bigint;
};

export type DepositPreview = {
  /** Share amount in share-token base units, quoted by the vault's own previewDeposit. */
  shares: bigint;
};

export type RedemptionPosition = {
  pendingRedeemShares: bigint;
  claimableRedeemAssets: bigint;
  claimableRedeemSharesEquivalent: bigint;
  /** Returned Shares: cancelled shares waiting for the claim that restores the wallet balance. */
  claimableCancelRedeemShares: bigint;
  /** Cancellation Processing: the position is locked until Centrifuge finishes the unwind. */
  hasPendingCancelRedeemRequest: boolean;
};
