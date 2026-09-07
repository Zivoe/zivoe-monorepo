import { CENTRIFUGE_ENVIRONMENT_FACTS, type ShareClassIdentity, type UsdcInstance } from '@zivoe/centrifuge-indexer';

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
 * Indicative USDC (base units of the given instance) for a share amount at
 * an 18-decimal Share Price. The instance is an input because USDC's scale
 * is per chain (6 on Circle-native chains, 18 on BNB Smart Chain) — the
 * caller passes the transacted chain's, never a constant. Lives beside the
 * environment singleton because, like it, this is the only other piece of
 * the Centrifuge module server code may import.
 */
export function sharesToUsdc({
  shares,
  sharePrice,
  shareClass,
  usdc
}: {
  shares: bigint;
  sharePrice: bigint;
  shareClass: Pick<ShareClassIdentity, 'decimals'>;
  usdc: Pick<UsdcInstance, 'decimals'>;
}): bigint {
  // Scale up by the asset's decimals before dividing out the share and price
  // scales — one positive exponent per factor, so no scale can go negative.
  return (shares * sharePrice * 10n ** BigInt(usdc.decimals)) / 10n ** BigInt(shareClass.decimals) / 10n ** 18n;
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
