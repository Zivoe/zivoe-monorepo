import { CENTRIFUGE_ENVIRONMENT_FACTS, type DepositAsset, type ShareClassIdentity } from '@zivoe/centrifuge-indexer';

import { ACTIVE_ENVIRONMENT } from '@/lib/chains';

/**
 * Facts of the deployment's Centrifuge environment, shared by every Zivoe
 * Vault and every chain: one SDK environment flag, one indexer. This stays a
 * singleton by design — per-chain and per-share-class facts live in the
 * shared catalog (`@zivoe/centrifuge-indexer`).
 */
export const CENTRIFUGE_ENV = {
  /** The SDK environment flag — selects its chain set and defaults. Same union as ours by construction. */
  environment: ACTIVE_ENVIRONMENT,
  indexerUrl: CENTRIFUGE_ENVIRONMENT_FACTS[ACTIVE_ENVIRONMENT].indexerUrl
};

/**
 * Indicative deposit-asset amount (base units of the given asset) for a
 * share amount at an 18-decimal Share Price. The asset is an input because
 * its scale is a fact of the transacted Centrifuge vault (USDC is 6 decimals
 * on Circle-native chains and 18 on BNB Smart Chain) — the caller passes the
 * identity's, never a constant. Lives beside the environment singleton
 * because, like it, this is the only other piece of the Centrifuge module
 * server code may import.
 */
export function sharesToDepositAsset({
  shares,
  sharePrice,
  shareClass,
  asset
}: {
  shares: bigint;
  sharePrice: bigint;
  shareClass: Pick<ShareClassIdentity, 'decimals'>;
  asset: Pick<DepositAsset, 'decimals'>;
}): bigint {
  // Scale up by the asset's decimals before dividing out the share and price
  // scales — one positive exponent per factor, so no scale can go negative.
  return (shares * sharePrice * 10n ** BigInt(asset.decimals)) / 10n ** BigInt(shareClass.decimals) / 10n ** 18n;
}

/**
 * 18-decimal USD value of a share amount at an 18-decimal Share Price. NAV is
 * the same conversion applied to the class's total issuance.
 */
export function sharesToValueD18({
  shares,
  sharePrice,
  shareClass
}: {
  shares: bigint;
  sharePrice: bigint;
  shareClass: Pick<ShareClassIdentity, 'decimals'>;
}): bigint {
  return (shares * sharePrice) / 10n ** BigInt(shareClass.decimals);
}
