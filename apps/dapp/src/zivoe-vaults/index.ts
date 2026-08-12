import { SHARE_CLASS_CATALOG, type ShareClassKey, getShareClassIdentity } from '@zivoe/centrifuge-indexer';

import { env } from '@/env';

// Type-only on purpose: server components import this module, and runtime
// @/centrifuge code beyond config.ts is client-only.
import { type TransactionIdentity } from '@/centrifuge/types';

import { assertZivoeVaultRegistryInvariants } from './invariants';
import { ZALT_ZIVOE_VAULT } from './zalt';
import { type ZivoeVault } from './zivoe-vault';
import { ZSMB_ZIVOE_VAULT } from './zsmb';

// The identity/presentation halves and the Centrifuge-vault shape stay internal to
// zivoeVault.ts — they document the serialization boundary there, and no
// consumer composes with them directly.
export {
  ZIVOE_VAULT_DETAIL_LABELS,
  type DerivedDetailLabel,
  type ZivoeVault,
  type ZivoeVaultDetailLabel,
  type ZivoeVaultStatus
} from './zivoe-vault';
export { zivoeVaultNetworkDisplays } from './network-display';
export { ZALT_ZIVOE_VAULT } from './zalt';
export { ZSMB_ZIVOE_VAULT } from './zsmb';

/**
 * Every Zivoe Vault module, keyed by its share class. `satisfies` over the
 * catalog's key union makes the compiler demand a module for every catalog
 * entry — a class cannot enter the catalog (and the aggregated NAV read)
 * without the module that gives it a card, a route, and display info.
 */
const REGISTERED_ZIVOE_VAULTS = {
  zsmb: ZSMB_ZIVOE_VAULT,
  zalt: ZALT_ZIVOE_VAULT
} satisfies Record<ShareClassKey, ZivoeVault>;

const ALL_ZIVOE_VAULTS: Array<ZivoeVault> = Object.values(REGISTERED_ZIVOE_VAULTS);

// The invariants take the record itself, so record-key/module agreement is
// checked in the same tested module as every other registration guard.
assertZivoeVaultRegistryInvariants({ zivoeVaults: REGISTERED_ZIVOE_VAULTS });

/**
 * The Zivoe Vaults this deployment serves: registered modules whose catalog
 * entry and Centrifuge vault are both live on the active network. Half-claims and
 * placeholder values under a deployable flag have already thrown in the
 * invariants, so this filter expresses availability only — a Zivoe Vault
 * absent or staged on the network is simply not listed.
 */
export const ZIVOE_VAULTS: Array<ZivoeVault> = ALL_ZIVOE_VAULTS.filter((zivoeVault) => {
  const network = env.NEXT_PUBLIC_NETWORK;
  const catalogEntry = SHARE_CLASS_CATALOG[zivoeVault.shareClass.key].networks[network];
  return Boolean(catalogEntry?.deployable && zivoeVault.centrifugeVaults[network]?.deployable);
});

// The dApp's product IS its Zivoe Vaults: a deployment serving none is a
// misconfigured cutover (flags not flipped for the active network), not an
// empty book — fail the build/boot loudly instead of rendering a shell.
if (ZIVOE_VAULTS.length === 0)
  throw new Error(
    `No Zivoe Vault is live on "${env.NEXT_PUBLIC_NETWORK}". Flip the catalog and Centrifuge-vault deployable flags for the network before deploying.`
  );

export function getZivoeVault(slug: string): ZivoeVault | undefined {
  return ZIVOE_VAULTS.find((zivoeVault) => zivoeVault.slug === slug);
}

/**
 * Resolves a Zivoe Vault's transaction identity on the active network — what
 * flows hand to every Centrifuge Module hook: the catalog identity joined
 * with the Zivoe Vault's own Centrifuge vault, plus the stable public identity for
 * analytics and Sentry. Throws for a network the Zivoe Vault is not live on.
 */
export function resolveTransactionIdentity(
  zivoeVault: Pick<ZivoeVault, 'slug' | 'shareClass' | 'centrifugeVaults'>
): TransactionIdentity {
  const network = env.NEXT_PUBLIC_NETWORK;
  const identity = getShareClassIdentity({ network, key: zivoeVault.shareClass.key });
  const centrifugeVault = zivoeVault.centrifugeVaults[network];

  if (!centrifugeVault?.deployable)
    throw new Error(`The "${zivoeVault.slug}" Zivoe Vault has no deployable Centrifuge vault on "${network}".`);

  return {
    zivoeVaultSlug: zivoeVault.slug,
    shareClass: { ...identity, centrifugeVaultAddress: centrifugeVault.address }
  };
}

export const ZIVOE_VAULT_PATH_PREFIX = '/vaults';

export function zivoeVaultPath(zivoeVault: Pick<ZivoeVault, 'slug'>): string {
  return `${ZIVOE_VAULT_PATH_PREFIX}/${zivoeVault.slug}`;
}

export function isZivoeVaultPath(pathname: string): boolean {
  return pathname.startsWith(`${ZIVOE_VAULT_PATH_PREFIX}/`);
}
