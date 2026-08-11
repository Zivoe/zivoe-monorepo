import { type Address } from 'viem';

import { type ShareClassIdentity } from '@zivoe/centrifuge-indexer';

/**
 * The share class a hook transacts and reads against — resolved from the
 * catalog and Centrifuge-vault map in the app, a synthetic fixture in tests. Composed
 * from the catalog's identity shape so a new identity field cannot be added
 * in one package and forgotten here, with `key`/`symbol` widened to plain
 * strings on purpose: the module stays a pure, testable boundary with no
 * registry coupling (this import is type-only).
 */
export type TransactedShareClass = Omit<ShareClassIdentity, 'key' | 'symbol'> & {
  /** Share-class id — the identity dimension of caches, query keys and Centrifuge-vault memoization. */
  key: string;
  symbol: string;
  centrifugeVaultAddress: Address;
};

/** Identity a Transaction Hook stamps on copy, analytics, Sentry, and the payload. */
export type TransactionIdentity = {
  /** Offering slug — the stable public identity alongside token symbols. */
  offeringSlug: string;
  shareClass: TransactedShareClass;
};

export type CentrifugeVaultCapacity = {
  /** Centrifuge-vault reserve capacity in USDC base units — never investor-scoped. */
  maxDeposit: bigint;
};

export type DepositPreview = {
  /** Share amount in share-token base units, quoted by the Centrifuge vault's own previewDeposit. */
  shares: bigint;
};

/**
 * The share token's transfer hook, asked about one wallet in the two
 * directions the flows move shares. Every Offering's Centrifuge vault is whitelisted, so
 * the issuer must admit a wallet before those moves execute — an un-admitted
 * wallet's transaction reverts on-chain, which no form validation would catch.
 *
 * Named for the transfers they permit rather than for the buttons they gate:
 * one direction gates several actions, and the mapping is not the obvious one
 * (see canReceiveShares).
 */
export type InvestorWhitelist = {
  /**
   * `checkTransferRestriction(0, investor, 0)` — the wallet may receive shares.
   *
   * Gates deposits, and ALSO cancelling a redemption request and claiming the
   * shares a cancellation returns: the protocol checks a cancellation with
   * this same call (AsyncRequestManager `cancelRedeemRequest`), and returning
   * shares from escrow is a transfer into the wallet. It is the identical read
   * the Centrifuge vault's own `isPermissioned` performs.
   */
  canReceiveShares: boolean;
  /**
   * `checkTransferRestriction(investor, ESCROW_HOOK_ID, 0)` — the wallet may
   * send shares to escrow, which is what a redemption request does.
   *
   * Gates the redemption request ONLY. Claiming the USDC a settled redemption
   * produced is deliberately exempt in the protocol (the hook returns true for
   * a redeem claim, and USDC carries no hook), so it must never be gated here.
   */
  canRequestRedemption: boolean;
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
