import { type CentrifugeChain, type DepositAsset, listDepositAssets, listLiveChains } from '@zivoe/centrifuge-indexer';

import { ACTIVE_ENVIRONMENT } from '@/lib/chains';

import { type ZivoeVault } from './zivoe-vault';

/**
 * The active chains this Zivoe Vault is live on, in deployment order — the
 * catalog's live chains on the deployment's environment. The result drives
 * the deposit/redeem chain selectors and the "available networks" surfaces,
 * so a Zivoe Vault can serve a subset of the deployment's chains.
 */
export function zivoeVaultChains(zivoeVault: Pick<ZivoeVault, 'shareClass'>): Array<CentrifugeChain> {
  return listLiveChains({ environment: ACTIVE_ENVIRONMENT, key: zivoeVault.shareClass.key });
}

/**
 * The distinct stablecoins this Zivoe Vault accepts across its live chains
 * in this deployment, deduped by symbol — the one derivation behind every
 * "accepted stablecoins" surface (listing card, Details row), deployment-
 * scoped like zivoeVaultChains so it never advertises an asset only a chain
 * this environment does not serve accepts.
 */
export function zivoeVaultDepositAssets(zivoeVault: Pick<ZivoeVault, 'shareClass'>): Array<DepositAsset> {
  return listDepositAssets({ environment: ACTIVE_ENVIRONMENT, key: zivoeVault.shareClass.key });
}
