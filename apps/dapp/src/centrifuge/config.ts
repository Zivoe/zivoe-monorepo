import { CENTRIFUGE_ENVIRONMENT_FACTS, USDC_DECIMALS, type ShareClassIdentity } from '@zivoe/centrifuge-indexer';

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
 * Indicative USDC (base units) for a share amount at an 18-decimal Share
 * Price. Lives beside the config because it is pure decimal math over it,
 * and — like the config — is the only piece server code may import.
 */
export function sharesToUsdc({
  shares,
  sharePrice,
  shareClass
}: {
  shares: bigint;
  sharePrice: bigint;
  shareClass: Pick<ShareClassIdentity, 'decimals'>;
}): bigint {
  return (shares * sharePrice) / 10n ** BigInt(shareClass.decimals) / 10n ** BigInt(18 - USDC_DECIMALS);
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
