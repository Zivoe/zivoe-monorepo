import {
  type CentrifugeChain,
  type ShareClassKey,
  getChainDeployment,
  getShareClassChainIdentity
} from '@zivoe/centrifuge-indexer';

import { ACTIVE_CHAINS } from '@/lib/chains';

// Type-only on purpose: server components import this module, and runtime
// @/centrifuge code beyond config.ts is client-only.
import { type TransactionIdentity } from '@/centrifuge/types';

import { zivoeVaultChains } from './availability';
import { type ZivoeVault, type ZivoeVaultFor } from './zivoe-vault';
import { ZSMB_ZIVOE_VAULT } from './zsmb';

// The identity/presentation halves stay internal to zivoeVault.ts — they
// document the serialization boundary there, and no consumer composes with
// them directly.
export {
  ZIVOE_VAULT_DETAIL_LABELS,
  type DerivedDetailLabel,
  type ZivoeVault,
  type ZivoeVaultDetailLabel,
  type ZivoeVaultStatus
} from './zivoe-vault';
export { zivoeVaultChains } from './availability';
export { zivoeVaultChainDisplays } from './chain-display';
export { ZSMB_ZIVOE_VAULT } from './zsmb';

/**
 * Every Zivoe Vault module, keyed by its share class. The `satisfies` makes
 * the compiler demand a module for every catalog entry, registered under the
 * key the module itself declares — a class cannot enter the catalog (and the
 * aggregated NAV read) without the module that gives it a card, a route, and
 * display info, and a module cannot be filed under another class's key.
 * Slug uniqueness and shape are linted by registry.test.ts.
 */
export const REGISTERED_ZIVOE_VAULTS = {
  zsmb: ZSMB_ZIVOE_VAULT
} satisfies { [K in ShareClassKey]: ZivoeVaultFor<K> };

/**
 * The Zivoe Vaults this deployment serves: registered modules live on at
 * least one active chain. A Zivoe Vault absent or staged on every active
 * chain is simply not listed.
 */
export const ZIVOE_VAULTS: Array<ZivoeVault> = Object.values(REGISTERED_ZIVOE_VAULTS).filter(
  (zivoeVault) => zivoeVaultChains(zivoeVault).length > 0
);

// The dApp's product IS its Zivoe Vaults: a deployment serving none is a
// misconfigured cutover (no class live on the active chains), not an empty
// book — fail the build/boot loudly instead of rendering a shell.
if (ZIVOE_VAULTS.length === 0)
  throw new Error(
    `No Zivoe Vault is live on any active chain (${ACTIVE_CHAINS.join(', ')}). Mark a catalog chain entry live before deploying.`
  );

export function getZivoeVault(slug: string): ZivoeVault | undefined {
  return ZIVOE_VAULTS.find((zivoeVault) => zivoeVault.slug === slug);
}

/**
 * Resolves a Zivoe Vault's transaction identity on ONE active chain — what
 * flows hand to every Centrifuge Module hook: the catalog's chain identity
 * joined with the chain's deployment facts, plus the stable public identity
 * for analytics and Sentry. Throws for a chain the Zivoe Vault is not live
 * on — callers pick the chain from zivoeVaultChains.
 */
export function resolveTransactionIdentity(
  zivoeVault: Pick<ZivoeVault, 'slug' | 'shareClass'>,
  chain: CentrifugeChain
): TransactionIdentity {
  const {
    chain: identityChain,
    chainId,
    centrifugeVaultAddress,
    ...shareClass
  } = getShareClassChainIdentity({ chain, key: zivoeVault.shareClass.key });

  // Chain facts are resolved ONCE here, onto the identity — hooks and flows
  // read usdc/vaultRouterAddress off the identity instead of the catalog in
  // render paths.
  const { usdc, vaultRouter, supportsRedeemCancellation } = getChainDeployment(chain);

  return {
    zivoeVaultSlug: zivoeVault.slug,
    centrifugeVault: {
      chain: identityChain,
      chainId,
      address: centrifugeVaultAddress,
      usdc,
      vaultRouterAddress: vaultRouter,
      supportsRedeemCancellation,
      shareClass
    }
  };
}

/**
 * One resolved identity per live chain, in deployment order — the value a
 * page hands the Zivoe Vault provider. Non-empty by type: the registry only
 * lists Zivoe Vaults live on at least one chain, and this throw keeps that
 * guarantee at the seam instead of in every client consumer.
 */
export function resolveZivoeVaultIdentities(
  zivoeVault: ZivoeVault
): [TransactionIdentity, ...Array<TransactionIdentity>] {
  const [first, ...rest] = zivoeVaultChains(zivoeVault).map((chain) => resolveTransactionIdentity(zivoeVault, chain));
  if (!first) throw new Error(`The "${zivoeVault.slug}" Zivoe Vault has no live chains.`);
  return [first, ...rest];
}

export const ZIVOE_VAULT_PATH_PREFIX = '/vaults';

export function zivoeVaultPath(zivoeVault: Pick<ZivoeVault, 'slug'>): string {
  return `${ZIVOE_VAULT_PATH_PREFIX}/${zivoeVault.slug}`;
}

export function isZivoeVaultPath(pathname: string): boolean {
  return pathname.startsWith(`${ZIVOE_VAULT_PATH_PREFIX}/`);
}
