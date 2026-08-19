import {
  CENTRIFUGE_CHAIN_FACTS,
  type CentrifugeChain,
  type CentrifugeEnvironment,
  SHARE_CLASS_CATALOG,
  ZERO_HEX,
  assertUnique
} from '@zivoe/centrifuge-indexer';

import { DEPOSIT_TOKENS } from '@/types/constants';

// Typed over the open string domain rather than the catalog unions — this is
// a runtime guard over registration data, and the fixture sweep runs it
// against synthetic classes the catalog deliberately does not know.
type RegisteredZivoeVault = {
  slug: string;
  shareClass: { key: string };
  centrifugeVaults: Partial<Record<CentrifugeChain, { address: string; deployable: boolean }>>;
};

type CatalogEntries = Record<
  string,
  {
    symbol: string;
    environments: Partial<
      Record<
        CentrifugeEnvironment,
        {
          poolId: string;
          scId: string;
          chains: Partial<Record<CentrifugeChain, { shareTokenAddress: string; deployable: boolean }>>;
        }
      >
    >;
  }
>;

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Import-time invariants over the Zivoe Vault registry — the codebase's existing
 * guard pattern. Registering a new Zivoe Vault either works end to end or fails
 * the build loudly; production traffic never sees a misregistration.
 *
 * Checked across EVERY chain the registration claims, in EVERY environment —
 * not only the active ones: mainnet values are registered from
 * testnet-deployed branches, and cutover is the expensive time to find a
 * duplicate. Exported (with an injectable catalog) so the fixture sweep can
 * exercise every guard.
 */
export function assertZivoeVaultRegistryInvariants({
  zivoeVaults: registered,
  catalog = SHARE_CLASS_CATALOG
}: {
  /** The registry record itself — every registered Zivoe Vault module, listed or not, keyed by share class. */
  zivoeVaults: Record<string, RegisteredZivoeVault>;
  catalog?: CatalogEntries;
}): void {
  // The record key is a claim; the module's own share class is the truth —
  // they must agree or class-keyed registration and the module would diverge.
  for (const [key, zivoeVault] of Object.entries(registered)) {
    if (key !== zivoeVault.shareClass.key)
      throw new Error(
        `Zivoe Vault "${zivoeVault.slug}" is registered under "${key}" but declares share class "${zivoeVault.shareClass.key}".`
      );
  }

  const zivoeVaults = Object.values(registered);

  // Lowercased like the on-chain identities: two slugs or keys differing only
  // in case would register as two Zivoe Vaults that read identically to a user,
  // while exact-match routing leaves one of them unreachable.
  assertUnique({
    values: zivoeVaults.map((zivoeVault) => zivoeVault.slug.toLowerCase()),
    message: (slug) => `Duplicate Zivoe Vault slug "${slug}".`
  });
  assertUnique({
    values: zivoeVaults.map((zivoeVault) => zivoeVault.shareClass.key.toLowerCase()),
    message: (key) => `Share class "${key}" is registered by two Zivoe Vaults.`
  });

  // The slug is a permanent public URL segment, concatenated unencoded into
  // routes, emails and external links — anything beyond kebab-case would
  // encode or normalize differently across those surfaces.
  for (const zivoeVault of zivoeVaults) {
    if (!SLUG_SHAPE.test(zivoeVault.slug))
      throw new Error(`Zivoe Vault slug "${zivoeVault.slug}" is not kebab-case ([a-z0-9], dash-separated).`);
  }

  for (const zivoeVault of zivoeVaults) {
    // Object.hasOwn for uniformity with the real trust boundaries: the keys
    // here are in-repo literals typed ShareClassKey in production, so this
    // guard is exercised by the open-string fixture sweep, not by traffic.
    const entry = Object.hasOwn(catalog, zivoeVault.shareClass.key) ? catalog[zivoeVault.shareClass.key] : undefined;
    if (!entry)
      throw new Error(
        `Zivoe Vault "${zivoeVault.slug}" references share class "${zivoeVault.shareClass.key}" not in the catalog.`
      );

    // The share-token display map spreads over the deposit-token map, so a
    // share class claiming a deposit asset's symbol would silently take over
    // that asset's display entry.
    if (DEPOSIT_TOKENS.some((token) => token.toLowerCase() === entry.symbol.toLowerCase()))
      throw new Error(`Share class "${zivoeVault.shareClass.key}" claims the deposit asset symbol "${entry.symbol}".`);

    // Chains claimed by either side, paired through the chain's own
    // environment: the catalog files a chain under its environment entry,
    // the Centrifuge-vault map claims chains globally.
    const catalogChains = new Set(
      Object.values(entry.environments).flatMap((onEnvironment) => Object.keys(onEnvironment.chains))
    ) as Set<CentrifugeChain>;
    const vaultChains = new Set(Object.keys(zivoeVault.centrifugeVaults)) as Set<CentrifugeChain>;
    const claimedChains = new Set<CentrifugeChain>([...catalogChains, ...vaultChains]);

    for (const chain of claimedChains) {
      const environment = CENTRIFUGE_CHAIN_FACTS[chain].environment;
      const onEnvironment = entry.environments[environment];
      const catalogEntry = onEnvironment?.chains[chain];
      const centrifugeVault = zivoeVault.centrifugeVaults[chain];

      // A half-claim would serve a page with no Centrifuge vault or a Centrifuge vault with no
      // catalog identity — both sides claim a chain, or neither does.
      if (!catalogEntry || !centrifugeVault)
        throw new Error(
          `Zivoe Vault "${zivoeVault.slug}" claims "${chain}" in ${
            catalogEntry ? 'the catalog but not its Centrifuge vaults' : 'its Centrifuge vaults but not the catalog'
          }.`
        );

      // The two deployable flags are one launch switch seen from two files.
      // Half-flipped they build green while the dApp serves zero chains for
      // the class and the catalog-driven surfaces count a chain the dApp will
      // not transact on.
      if (catalogEntry.deployable !== centrifugeVault.deployable)
        throw new Error(
          `Share class "${zivoeVault.shareClass.key}" on "${chain}" is ${
            catalogEntry.deployable
              ? 'catalog-deployable but its Centrifuge vault is not'
              : 'Centrifuge-vault-deployable but its catalog entry is not'
          }. Flip both flags together.`
        );

      // deployable: true asserts operator-verified values — zero values under
      // that flag are a flipped flag, not a staged launch. The hub-level ids
      // are checked here too: a deployable chain under an environment whose
      // poolId/scId are placeholders would query the indexer for nothing.
      if (
        catalogEntry.deployable &&
        (isZeroPoolId(onEnvironment.poolId) ||
          ZERO_HEX.test(onEnvironment.scId) ||
          ZERO_HEX.test(catalogEntry.shareTokenAddress))
      )
        throw new Error(
          `Share class "${zivoeVault.shareClass.key}" on "${chain}" is deployable but carries placeholder identity values.`
        );

      if (centrifugeVault.deployable && ZERO_HEX.test(centrifugeVault.address))
        throw new Error(
          `The "${zivoeVault.slug}" Zivoe Vault's Centrifuge vault on "${chain}" is deployable but carries a placeholder address.`
        );
    }
  }

  // Centrifuge-vault addresses must be unique per chain across every
  // registered entry, staged or live — two Zivoe Vaults sharing one would
  // decode each other's receipts. Per CHAIN, not per environment: one address
  // on two chains is legitimate under deterministic deployment and must not
  // false-positive. Placeholder zeros are excluded: staged launches
  // legitimately share them until values are operator-verified.
  // (Catalog-internal identity uniqueness — symbols, scIds, share tokens — is
  // the catalog's own import-time sweep in @zivoe/centrifuge-indexer, so
  // landing-only builds are guarded too.)
  const allChains = new Set<CentrifugeChain>(
    zivoeVaults.flatMap((zivoeVault) => Object.keys(zivoeVault.centrifugeVaults) as Array<CentrifugeChain>)
  );

  for (const chain of allChains) {
    assertUnique({
      values: zivoeVaults
        .flatMap((zivoeVault) => {
          const centrifugeVault = zivoeVault.centrifugeVaults[chain];
          return centrifugeVault ? [centrifugeVault.address.toLowerCase()] : [];
        })
        .filter((address) => !ZERO_HEX.test(address)),
      message: (address) => `Centrifuge vault ${address} is claimed by two share classes on "${chain}".`
    });
  }
}

/** A pool id is placeholder when it is not a positive integer. */
function isZeroPoolId(poolId: string): boolean {
  try {
    return BigInt(poolId) <= 0n;
  } catch {
    return true;
  }
}
