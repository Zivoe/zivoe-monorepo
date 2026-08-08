import { describe, expect, it } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { assertOfferingRegistryInvariants } from './invariants';

const FIXTURE_SHARE_CLASS = FIXTURE_IDENTITY.shareClass;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_SC_ID = '0x00000000000000000000000000000000';

type NetworkName = 'sepolia' | 'mainnet';

type Registration = {
  offering: {
    slug: string;
    shareClass: { key: string };
    vaults: Partial<Record<NetworkName, { address: string; deployable: boolean }>>;
  };
  catalogEntry: {
    symbol: string;
    networks: Partial<
      Record<NetworkName, { poolId: string; scId: string; shareTokenAddress: string; deployable: boolean }>
    >;
  };
};

/** One registered class — the module half and its catalog half, live on sepolia. */
function makeRegistration({
  key,
  slug = `${key}-offering`,
  scId,
  shareTokenAddress,
  vaultAddress
}: {
  key: string;
  slug?: string;
  scId: string;
  shareTokenAddress: string;
  vaultAddress: string;
}): Registration {
  return {
    offering: {
      slug,
      shareClass: { key },
      vaults: { sepolia: { address: vaultAddress, deployable: true } }
    },
    catalogEntry: {
      symbol: `z${key}`,
      networks: { sepolia: { poolId: '77', scId, shareTokenAddress, deployable: true } }
    }
  };
}

function assertRegistry(registrations: Array<Registration>) {
  assertOfferingRegistryInvariants({
    offerings: Object.fromEntries(
      registrations.map((registration) => [registration.offering.shareClass.key, registration.offering])
    ),
    catalog: Object.fromEntries(
      registrations.map((registration) => [registration.offering.shareClass.key, registration.catalogEntry])
    )
  });
}

const fixture = makeRegistration({
  key: FIXTURE_SHARE_CLASS.key,
  slug: 'fixture-offering',
  scId: FIXTURE_SHARE_CLASS.scId,
  shareTokenAddress: FIXTURE_SHARE_CLASS.shareTokenAddress,
  vaultAddress: FIXTURE_SHARE_CLASS.vaultAddress
});

const other = makeRegistration({
  key: 'other',
  scId: '0x000100000000eeee0000000000000001',
  shareTokenAddress: '0xbebebebebebebebebebebebebebebebebebebebe',
  vaultAddress: '0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd'
});

describe('assertOfferingRegistryInvariants', () => {
  it('accepts a registry of distinct identities, including shared placeholder zeros on a staged network', () => {
    const staged = (registration: Registration): Registration => ({
      offering: {
        ...registration.offering,
        vaults: { ...registration.offering.vaults, mainnet: { address: ZERO_ADDRESS, deployable: false } }
      },
      catalogEntry: {
        ...registration.catalogEntry,
        networks: {
          ...registration.catalogEntry.networks,
          mainnet: { poolId: '0', scId: ZERO_SC_ID, shareTokenAddress: ZERO_ADDRESS, deployable: false }
        }
      }
    });

    expect(() => assertRegistry([staged(fixture), staged(other)])).not.toThrow();
  });

  it('accepts a testnet-only class next to one also claiming mainnet', () => {
    const withMainnet: Registration = {
      offering: {
        ...other.offering,
        vaults: {
          ...other.offering.vaults,
          mainnet: { address: '0xadadadadadadadadadadadadadadadadadadadad', deployable: true }
        }
      },
      catalogEntry: {
        ...other.catalogEntry,
        networks: {
          ...other.catalogEntry.networks,
          mainnet: {
            poolId: '88',
            scId: '0x000100000000ffff0000000000000001',
            shareTokenAddress: '0xfafafafafafafafafafafafafafafafafafafafa',
            deployable: true
          }
        }
      }
    };

    expect(() => assertRegistry([fixture, withMainnet])).not.toThrow();
  });

  it('throws on a duplicate slug, compared case-insensitively', () => {
    expect(() =>
      assertRegistry([fixture, { ...other, offering: { ...other.offering, slug: fixture.offering.slug } }])
    ).toThrow(/Duplicate Offering slug/);

    // Case-shifted on purpose: exact-match routing would leave one of these
    // two "distinct" products unreachable.
    expect(() =>
      assertRegistry([
        fixture,
        { ...other, offering: { ...other.offering, slug: fixture.offering.slug.toUpperCase() } }
      ])
    ).toThrow(/Duplicate Offering slug/);
  });

  it('throws on a slug that is not kebab-case', () => {
    for (const slug of ['fixture offering', 'Fixture-Offering', '../..', 'fixture?x=1']) {
      const malformed: Registration = { ...fixture, offering: { ...fixture.offering, slug } };
      expect(() => assertRegistry([malformed])).toThrow(/kebab-case/);
    }
  });

  it('throws when a share class claims a deposit asset symbol, compared case-insensitively', () => {
    const usdc: Registration = { ...fixture, catalogEntry: { ...fixture.catalogEntry, symbol: 'usdc' } };
    expect(() => assertRegistry([usdc])).toThrow(/deposit asset/);
  });

  it('throws when two Offerings register the same share class', () => {
    // A case variant on purpose: the record itself cannot hold an exact
    // duplicate key, so the case-insensitive sweep is the reachable guard.
    const duplicate: Registration = {
      ...other,
      offering: { ...other.offering, shareClass: { key: FIXTURE_SHARE_CLASS.key.toUpperCase() } }
    };

    expect(() =>
      assertOfferingRegistryInvariants({
        offerings: {
          [fixture.offering.shareClass.key]: fixture.offering,
          [duplicate.offering.shareClass.key]: duplicate.offering
        },
        catalog: { [FIXTURE_SHARE_CLASS.key]: fixture.catalogEntry }
      })
    ).toThrow(/registered by two Offerings/);
  });

  it('throws when the record key disagrees with the module it registers', () => {
    expect(() => assertOfferingRegistryInvariants({ offerings: { wrong: fixture.offering }, catalog: {} })).toThrow(
      /registered under "wrong"/
    );
  });

  it('throws when an Offering references a share class the catalog does not know', () => {
    expect(() =>
      assertOfferingRegistryInvariants({
        offerings: { [fixture.offering.shareClass.key]: fixture.offering },
        catalog: {}
      })
    ).toThrow(/not in the catalog/);
  });

  it('throws the not-in-catalog error for a prototype-chain key, not a TypeError', () => {
    expect(() =>
      assertOfferingRegistryInvariants({
        offerings: { toString: { slug: 'ghost-offering', shareClass: { key: 'toString' }, vaults: {} } },
        catalog: {}
      })
    ).toThrow(/not in the catalog/);
  });

  it('throws on a half-claimed network, in both directions', () => {
    const catalogOnly: Registration = {
      ...other,
      offering: { ...other.offering, vaults: {} }
    };
    expect(() => assertRegistry([catalogOnly])).toThrow(/claims "sepolia" in the catalog but not its vaults/);

    const vaultOnly: Registration = {
      ...other,
      catalogEntry: { ...other.catalogEntry, networks: {} }
    };
    expect(() => assertRegistry([vaultOnly])).toThrow(/claims "sepolia" in its vaults but not the catalog/);
  });

  it('throws when the catalog and vault deployable flags disagree, in both directions', () => {
    const sepoliaVault = other.offering.vaults.sepolia;
    const sepoliaEntry = other.catalogEntry.networks.sepolia;
    if (!sepoliaVault || !sepoliaEntry) throw new Error('the "other" registration must claim sepolia');

    // The exact staging state a mainnet cutover passes through: one half
    // flipped live, the other still a verified-but-staged entry.
    const catalogLiveVaultStaged: Registration = {
      ...other,
      offering: {
        ...other.offering,
        vaults: { sepolia: { address: sepoliaVault.address, deployable: false } }
      }
    };
    expect(() => assertRegistry([catalogLiveVaultStaged])).toThrow(/catalog-deployable but its vault is not/);

    const vaultLiveCatalogStaged: Registration = {
      ...other,
      catalogEntry: {
        ...other.catalogEntry,
        networks: { sepolia: { ...sepoliaEntry, deployable: false } }
      }
    };
    expect(() => assertRegistry([vaultLiveCatalogStaged])).toThrow(/vault-deployable but its catalog entry is not/);
  });

  it('throws on placeholder values under a deployable flag', () => {
    const flippedCatalog: Registration = {
      ...other,
      catalogEntry: {
        ...other.catalogEntry,
        networks: { sepolia: { poolId: '0', scId: ZERO_SC_ID, shareTokenAddress: ZERO_ADDRESS, deployable: true } }
      }
    };
    expect(() => assertRegistry([flippedCatalog])).toThrow(/deployable but carries placeholder identity values/);

    const flippedVault: Registration = {
      ...other,
      offering: { ...other.offering, vaults: { sepolia: { address: ZERO_ADDRESS, deployable: true } } }
    };
    expect(() => assertRegistry([flippedVault])).toThrow(/deployable but carries a placeholder address/);
  });

  it('throws when two share classes share a vault, compared case-insensitively', () => {
    expect(() =>
      assertRegistry([
        fixture,
        {
          ...other,
          offering: {
            ...other.offering,
            // Case-shifted on purpose: identity comparisons must be case-insensitive.
            vaults: { sepolia: { address: FIXTURE_SHARE_CLASS.vaultAddress.toUpperCase(), deployable: true } }
          }
        }
      ])
    ).toThrow(/Vault .* is claimed by two share classes/);
  });

  it('throws on a duplicate vault on a non-active network — the sweep covers every claimed network', () => {
    const onMainnet = (registration: Registration, index: number): Registration => ({
      offering: {
        ...registration.offering,
        vaults: {
          ...registration.offering.vaults,
          mainnet: { address: '0xadadadadadadadadadadadadadadadadadadadad', deployable: true }
        }
      },
      catalogEntry: {
        ...registration.catalogEntry,
        networks: {
          ...registration.catalogEntry.networks,
          mainnet: {
            poolId: '99',
            scId: `0x000100000000dddd000000000000000${index}`,
            shareTokenAddress: `0xcccccccccccccccccccccccccccccccccccccc${index}0`,
            deployable: true
          }
        }
      }
    });

    expect(() => assertRegistry([onMainnet(fixture, 1), onMainnet(other, 2)])).toThrow(
      /Vault .* is claimed by two share classes on "mainnet"/
    );
  });
});
