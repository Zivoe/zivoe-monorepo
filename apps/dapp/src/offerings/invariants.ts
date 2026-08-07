import { type CentrifugeNetwork, SHARE_CLASS_CATALOG } from '@zivoe/centrifuge-indexer';

// Typed over the open string domain rather than the catalog unions — this is
// a runtime guard over registration data, and the fixture sweep runs it
// against synthetic classes the catalog deliberately does not know.
type RegisteredOffering = {
  slug: string;
  shareClass: { key: string; symbol: string };
  vaults: Partial<Record<CentrifugeNetwork, { address: string; deployable: boolean }>>;
};

type CatalogEntries = Record<
  string,
  {
    networks: Partial<
      Record<CentrifugeNetwork, { poolId: string; scId: string; shareTokenAddress: string; deployable: boolean }>
    >;
  }
>;

const ZERO_HEX = /^0x0+$/i;

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
  assertUnique({
    values: offerings.map((offering) => offering.slug),
    message: (slug) => `Duplicate Offering slug "${slug}".`
  });
  assertUnique({
    values: offerings.map((offering) => offering.shareClass.key),
    message: (key) => `Share class "${key}" is registered by two Offerings.`
  });
  // Symbols key the token display map — two classes sharing one would render
  // one product's token as the other's.
  assertUnique({
    values: offerings.map((offering) => offering.shareClass.symbol),
    message: (symbol) => `Share token symbol "${symbol}" is claimed by two Offerings.`
  });

  for (const offering of offerings) {
    const entry = catalog[offering.shareClass.key];
    if (!entry)
      throw new Error(
        `Offering "${offering.slug}" references share class "${offering.shareClass.key}" not in the catalog.`
      );

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

  // On-chain identities must be unique per network across every registered
  // entry, staged or live — two entries sharing one would serve one product's
  // data under the other's name. Placeholder zeros are excluded: staged
  // launches legitimately share them until values are operator-verified.
  const allNetworks = new Set<CentrifugeNetwork>(
    offerings.flatMap((offering) => Object.keys(offering.vaults) as Array<CentrifugeNetwork>)
  );

  for (const network of allNetworks) {
    const entries = offerings.flatMap((offering) => {
      const catalogEntry = catalog[offering.shareClass.key]?.networks[network];
      const vault = offering.vaults[network];
      return catalogEntry && vault ? [{ catalogEntry, vault }] : [];
    });

    assertUnique({
      values: entries.map((entry) => entry.catalogEntry.scId.toLowerCase()).filter((scId) => !ZERO_HEX.test(scId)),
      message: (scId) => `Share-class id ${scId} is claimed by two catalog entries on "${network}".`
    });
    assertUnique({
      values: entries
        .map((entry) => entry.catalogEntry.shareTokenAddress.toLowerCase())
        .filter((address) => !ZERO_HEX.test(address)),
      message: (address) => `Share token ${address} is claimed by two share classes on "${network}".`
    });
    assertUnique({
      values: entries.map((entry) => entry.vault.address.toLowerCase()).filter((address) => !ZERO_HEX.test(address)),
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

function assertUnique({ values, message }: { values: Array<string>; message: (duplicate: string) => string }) {
  const seen = new Set<string>();

  for (const value of values) {
    if (seen.has(value)) throw new Error(message(value));
    seen.add(value);
  }
}
