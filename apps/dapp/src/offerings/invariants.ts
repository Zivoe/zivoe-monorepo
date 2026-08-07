import { type CentrifugeNetwork, SHARE_CLASS_CATALOG, ZERO_HEX, assertUnique } from '@zivoe/centrifuge-indexer';

import { DEPOSIT_TOKENS } from '@/types/constants';

// Typed over the open string domain rather than the catalog unions — this is
// a runtime guard over registration data, and the fixture sweep runs it
// against synthetic classes the catalog deliberately does not know.
type RegisteredOffering = {
  slug: string;
  shareClass: { key: string };
  vaults: Partial<Record<CentrifugeNetwork, { address: string; deployable: boolean }>>;
};

type CatalogEntries = Record<
  string,
  {
    symbol: string;
    networks: Partial<
      Record<CentrifugeNetwork, { poolId: string; scId: string; shareTokenAddress: string; deployable: boolean }>
    >;
  }
>;

const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Import-time invariants over the Offering registry — the codebase's existing
 * guard pattern. Registering a new Offering either works end to end or fails
 * the build loudly; production traffic never sees a misregistration.
 *
 * Checked across EVERY network the registration claims, not only the active
 * one: mainnet values are registered from testnet-deployed branches, and
 * cutover is the expensive time to find a duplicate. Exported (with an
 * injectable catalog) so the fixture sweep can exercise every guard.
 */
export function assertOfferingRegistryInvariants({
  offerings,
  catalog = SHARE_CLASS_CATALOG
}: {
  /** Every registered Offering module, listed or not. */
  offerings: Array<RegisteredOffering>;
  catalog?: CatalogEntries;
}): void {
  // Lowercased like the on-chain identities: two slugs or keys differing only
  // in case would register as two Offerings that read identically to a user,
  // while exact-match routing leaves one of them unreachable.
  assertUnique({
    values: offerings.map((offering) => offering.slug.toLowerCase()),
    message: (slug) => `Duplicate Offering slug "${slug}".`
  });
  assertUnique({
    values: offerings.map((offering) => offering.shareClass.key.toLowerCase()),
    message: (key) => `Share class "${key}" is registered by two Offerings.`
  });

  // The slug is a permanent public URL segment, concatenated unencoded into
  // routes, emails and external links — anything beyond kebab-case would
  // encode or normalize differently across those surfaces.
  for (const offering of offerings) {
    if (!SLUG_SHAPE.test(offering.slug))
      throw new Error(`Offering slug "${offering.slug}" is not kebab-case ([a-z0-9], dash-separated).`);
  }

  for (const offering of offerings) {
    // Object.hasOwn: a prototype-chain key like "toString" is truthy under a
    // plain index and would skip the not-in-catalog throw.
    const entry = Object.hasOwn(catalog, offering.shareClass.key) ? catalog[offering.shareClass.key] : undefined;
    if (!entry)
      throw new Error(
        `Offering "${offering.slug}" references share class "${offering.shareClass.key}" not in the catalog.`
      );

    // The share-token display map spreads over the deposit-token map, so a
    // share class claiming a deposit asset's symbol would silently take over
    // that asset's display entry.
    if (DEPOSIT_TOKENS.some((token) => token.toLowerCase() === entry.symbol.toLowerCase()))
      throw new Error(`Share class "${offering.shareClass.key}" claims the deposit asset symbol "${entry.symbol}".`);

    const claimedNetworks = new Set<CentrifugeNetwork>([
      ...(Object.keys(entry.networks) as Array<CentrifugeNetwork>),
      ...(Object.keys(offering.vaults) as Array<CentrifugeNetwork>)
    ]);

    for (const network of claimedNetworks) {
      const catalogEntry = entry.networks[network];
      const vault = offering.vaults[network];

      // A half-claim would serve a page with no vault or a vault with no
      // catalog identity — both sides claim a network, or neither does.
      if (!catalogEntry || !vault)
        throw new Error(
          `Offering "${offering.slug}" claims "${network}" in ${
            catalogEntry ? 'the catalog but not its vaults' : 'its vaults but not the catalog'
          }.`
        );

      // The two deployable flags are one launch switch seen from two files.
      // Half-flipped they build green while the dApp serves zero Offerings and
      // the catalog-driven surfaces count a class the dApp will not route.
      if (catalogEntry.deployable !== vault.deployable)
        throw new Error(
          `Share class "${offering.shareClass.key}" on "${network}" is ${
            catalogEntry.deployable
              ? 'catalog-deployable but its vault is not'
              : 'vault-deployable but its catalog entry is not'
          }. Flip both flags together.`
        );

      // deployable: true asserts operator-verified values — zero values under
      // that flag are a flipped flag, not a staged launch.
      if (
        catalogEntry.deployable &&
        (isZeroPoolId(catalogEntry.poolId) ||
          ZERO_HEX.test(catalogEntry.scId) ||
          ZERO_HEX.test(catalogEntry.shareTokenAddress))
      )
        throw new Error(
          `Share class "${offering.shareClass.key}" on "${network}" is deployable but carries placeholder identity values.`
        );

      if (vault.deployable && ZERO_HEX.test(vault.address))
        throw new Error(
          `The "${offering.slug}" Offering's vault on "${network}" is deployable but carries a placeholder address.`
        );
    }
  }

  // Vault addresses must be unique per network across every registered entry,
  // staged or live — two Offerings sharing one would decode each other's
  // receipts. Placeholder zeros are excluded: staged launches legitimately
  // share them until values are operator-verified. (Catalog-internal identity
  // uniqueness — symbols, scIds, share tokens — is the catalog's own
  // import-time sweep in @zivoe/centrifuge-indexer, so landing-only builds
  // are guarded too.)
  const allNetworks = new Set<CentrifugeNetwork>(
    offerings.flatMap((offering) => Object.keys(offering.vaults) as Array<CentrifugeNetwork>)
  );

  for (const network of allNetworks) {
    assertUnique({
      values: offerings
        .flatMap((offering) => {
          const vault = offering.vaults[network];
          return vault ? [vault.address.toLowerCase()] : [];
        })
        .filter((address) => !ZERO_HEX.test(address)),
      message: (address) => `Vault ${address} is claimed by two share classes on "${network}".`
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
