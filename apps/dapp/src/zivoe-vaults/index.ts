import { type CentrifugeChain, type ShareClassKey, getShareClassChainIdentity } from '@zivoe/centrifuge-indexer';

import { ACTIVE_CHAINS } from '@/lib/chains';

import { getChainConfig, isChainConfigDeployable } from '@/centrifuge/config';
// Type-only on purpose: server components import this module, and runtime
// @/centrifuge code beyond config.ts is client-only.
import { type TransactionIdentity } from '@/centrifuge/types';

import { zivoeVaultChains } from './availability';
import { assertZivoeVaultRegistryInvariants } from './invariants';
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
export { zivoeVaultChains } from './availability';
export { zivoeVaultChainDisplays } from './chain-display';
export { ZSMB_ZIVOE_VAULT } from './zsmb';

/**
 * Every Zivoe Vault module, keyed by its share class. `satisfies` over the
 * catalog's key union makes the compiler demand a module for every catalog
 * entry — a class cannot enter the catalog (and the aggregated NAV read)
 * without the module that gives it a card, a route, and display info.
 */
const REGISTERED_ZIVOE_VAULTS = {
  zsmb: ZSMB_ZIVOE_VAULT
} satisfies Record<ShareClassKey, ZivoeVault>;

const ALL_ZIVOE_VAULTS: Array<ZivoeVault> = Object.values(REGISTERED_ZIVOE_VAULTS);

// The invariants take the record itself, so record-key/module agreement is
// checked in the same tested module as every other registration guard.
assertZivoeVaultRegistryInvariants({ zivoeVaults: REGISTERED_ZIVOE_VAULTS });

/**
 * The Zivoe Vaults this deployment serves: registered modules live on at
 * least one active chain. A Zivoe Vault absent or staged on every active
 * chain is simply not listed.
 */
export const ZIVOE_VAULTS: Array<ZivoeVault> = ALL_ZIVOE_VAULTS.filter(
  (zivoeVault) => zivoeVaultChains(zivoeVault).length > 0
);

// The dApp's product IS its Zivoe Vaults: a deployment serving none is a
// misconfigured cutover (flags not flipped for the active chains), not an
// empty book — fail the build/boot loudly instead of rendering a shell.
if (ZIVOE_VAULTS.length === 0)
  throw new Error(
    `No Zivoe Vault is live on any active chain (${ACTIVE_CHAINS.join(', ')}). Flip the catalog and Centrifuge-vault deployable flags before deploying.`
  );

// A chain the flows will transact on needs live environment constants too
// (VaultRouter, USDC) — those live in a third file the catalog/Centrifuge-vault
// invariants cannot see, and a placeholder there would otherwise surface as
// a render-time throw instead of a boot failure.
for (const zivoeVault of ZIVOE_VAULTS) {
  for (const chain of zivoeVaultChains(zivoeVault)) {
    if (!isChainConfigDeployable(chain))
      throw new Error(
        `Chain "${chain}" is live for "${zivoeVault.slug}" but its Centrifuge chain config is a placeholder. Fill the chain constants before deploying.`
      );
  }
}

export function getZivoeVault(slug: string): ZivoeVault | undefined {
  return ZIVOE_VAULTS.find((zivoeVault) => zivoeVault.slug === slug);
}

/**
 * Resolves a Zivoe Vault's transaction identity on ONE active chain — what
 * flows hand to every Centrifuge Module hook: the catalog identity joined
 * with the Zivoe Vault's own Centrifuge vault on that chain, plus the stable
 * public identity for analytics and Sentry. Throws for a chain the Zivoe
 * Vault is not live on — callers pick the chain from zivoeVaultChains.
 */
export function resolveTransactionIdentity(
  zivoeVault: Pick<ZivoeVault, 'slug' | 'shareClass' | 'centrifugeVaults'>,
  chain: CentrifugeChain
): TransactionIdentity {
  const {
    chain: identityChain,
    chainId,
    ...shareClass
  } = getShareClassChainIdentity({ chain, key: zivoeVault.shareClass.key });
  const centrifugeVault = zivoeVault.centrifugeVaults[chain];

  if (!centrifugeVault?.deployable)
    throw new Error(`The "${zivoeVault.slug}" Zivoe Vault has no deployable Centrifuge vault on "${chain}".`);

  // The chain config (a throwing lookup) is resolved ONCE here, onto the
  // identity — hooks and flows read usdc/vaultRouterAddress off the identity
  // instead of re-deriving chain config in render paths.
  const { usdc, vaultRouterAddress, supportsRedeemCancellation } = getChainConfig(chain);

  return {
    zivoeVaultSlug: zivoeVault.slug,
    centrifugeVault: {
      chain: identityChain,
      chainId,
      address: centrifugeVault.address,
      usdc,
      vaultRouterAddress,
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
