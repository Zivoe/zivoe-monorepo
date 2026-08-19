import { type CentrifugeChain, SHARE_CLASS_CATALOG, type ShareClassCatalogEntry } from '@zivoe/centrifuge-indexer';

import { ACTIVE_CHAINS, ACTIVE_ENVIRONMENT } from '@/lib/network';

import { type ZivoeVault } from './zivoe-vault';

/**
 * The active chains this Zivoe Vault is live on, in deployment order: chains
 * where the catalog entry AND the module's Centrifuge vault are both
 * deployable. Half-claims and placeholder values under a deployable flag have
 * already thrown in the registry invariants, so this filter expresses
 * availability only. The result drives the deposit/redeem chain selectors and
 * the "available networks" surfaces, so a Zivoe Vault can serve a subset of
 * the deployment's chains.
 */
export function zivoeVaultChains(
  zivoeVault: Pick<ZivoeVault, 'shareClass' | 'centrifugeVaults'>
): Array<CentrifugeChain> {
  const entry: ShareClassCatalogEntry = SHARE_CLASS_CATALOG[zivoeVault.shareClass.key];
  const catalogChains = entry.environments[ACTIVE_ENVIRONMENT]?.chains;

  return ACTIVE_CHAINS.filter(
    (chain) => Boolean(catalogChains?.[chain]?.deployable) && Boolean(zivoeVault.centrifugeVaults[chain]?.deployable)
  );
}
