import { type Address } from 'viem';

import { type ShareClassChainIdentity } from '@zivoe/centrifuge-indexer';

import { type UsdcInstance } from './config';

/**
 * The Centrifuge vault a hook transacts and reads against — one share class
 * paired with its deposit asset on ONE spoke chain. Resolved from the catalog
 * and Centrifuge-vault map in the app, a synthetic fixture in tests. The hub
 * half is composed from the catalog's chain-identity shape so a new identity
 * field cannot be added in one package and forgotten here, with
 * `key`/`symbol` widened to plain strings on purpose: the module stays a
 * pure, testable boundary with no registry coupling (these imports are
 * type-only). The chain is part of the identity: the same class on another
 * chain is a different Centrifuge vault, a different wallet balance, and a
 * different cache entry.
 */
export type TransactedCentrifugeVault = Pick<ShareClassChainIdentity, 'chain' | 'chainId'> & {
  /** The Centrifuge vault's own address on the chain. */
  address: Address;
  /** The chain's USDC instance — resolved onto the identity so hooks and flows never re-derive chain config (a throwing lookup) in render paths. */
  usdc: UsdcInstance;
  /** The chain's VaultRouter — deposits route through it, so it is the USDC approval spender. */
  vaultRouterAddress: Address;
  /** The share class the Centrifuge vault serves: hub facts plus its token instance on this chain. */
  shareClass: Omit<ShareClassChainIdentity, 'chain' | 'chainId' | 'key' | 'symbol'> & {
    /** Share-class id — the identity dimension of caches, query keys and Centrifuge-vault memoization (alongside `chain`). */
    key: string;
    symbol: string;
  };
};

/** Identity a Transaction Hook stamps on copy, analytics, Sentry, and the payload. */
export type TransactionIdentity = {
  /** Zivoe Vault slug — the stable public identity alongside token symbols. */
  zivoeVaultSlug: string;
  centrifugeVault: TransactedCentrifugeVault;
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
 * directions the flows move shares. Every Zivoe Vault's Centrifuge vault is whitelisted, so
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
