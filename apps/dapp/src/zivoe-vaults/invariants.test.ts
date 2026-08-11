import { describe, expect, it } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { assertZivoeVaultRegistryInvariants } from './invariants';

const FIXTURE_SHARE_CLASS = FIXTURE_IDENTITY.shareClass;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_SC_ID = '0x00000000000000000000000000000000';

type NetworkName = 'sepolia' | 'mainnet';

type Registration = {
  zivoeVault: {
    slug: string;
    shareClass: { key: string };
    centrifugeVaults: Partial<Record<NetworkName, { address: string; deployable: boolean }>>;
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
  slug = `${key}-zivoe-vault`,
  scId,
  shareTokenAddress,
  centrifugeVaultAddress
}: {
  key: string;
  slug?: string;
  scId: string;
  shareTokenAddress: string;
  centrifugeVaultAddress: string;
}): Registration {
  return {
    zivoeVault: {
      slug,
      shareClass: { key },
      centrifugeVaults: { sepolia: { address: centrifugeVaultAddress, deployable: true } }
    },
    catalogEntry: {
      symbol: `z${key}`,
      networks: { sepolia: { poolId: '77', scId, shareTokenAddress, deployable: true } }
    }
  };
}

function assertRegistry(registrations: Array<Registration>) {
  assertZivoeVaultRegistryInvariants({
    zivoeVaults: Object.fromEntries(
      registrations.map((registration) => [registration.zivoeVault.shareClass.key, registration.zivoeVault])
    ),
    catalog: Object.fromEntries(
      registrations.map((registration) => [registration.zivoeVault.shareClass.key, registration.catalogEntry])
    )
  });
}

const fixture = makeRegistration({
  key: FIXTURE_SHARE_CLASS.key,
  slug: 'fixture-zivoe-vault',
  scId: FIXTURE_SHARE_CLASS.scId,
  shareTokenAddress: FIXTURE_SHARE_CLASS.shareTokenAddress,
  centrifugeVaultAddress: FIXTURE_SHARE_CLASS.centrifugeVaultAddress
});

const other = makeRegistration({
  key: 'other',
  scId: '0x000100000000eeee0000000000000001',
  shareTokenAddress: '0xbebebebebebebebebebebebebebebebebebebebe',
  centrifugeVaultAddress: '0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd'
});

describe('assertZivoeVaultRegistryInvariants', () => {
  it('accepts a registry of distinct identities, including shared placeholder zeros on a staged network', () => {
    const staged = (registration: Registration): Registration => ({
      zivoeVault: {
        ...registration.zivoeVault,
        centrifugeVaults: {
          ...registration.zivoeVault.centrifugeVaults,
          mainnet: { address: ZERO_ADDRESS, deployable: false }
        }
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
      zivoeVault: {
        ...other.zivoeVault,
        centrifugeVaults: {
          ...other.zivoeVault.centrifugeVaults,
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
      assertRegistry([fixture, { ...other, zivoeVault: { ...other.zivoeVault, slug: fixture.zivoeVault.slug } }])
    ).toThrow(/Duplicate Zivoe Vault slug/);

    // Case-shifted on purpose: exact-match routing would leave one of these
    // two "distinct" products unreachable.
    expect(() =>
      assertRegistry([
        fixture,
        { ...other, zivoeVault: { ...other.zivoeVault, slug: fixture.zivoeVault.slug.toUpperCase() } }
      ])
    ).toThrow(/Duplicate Zivoe Vault slug/);
  });

  it('throws on a slug that is not kebab-case', () => {
    for (const slug of ['fixture zivoe vault', 'Fixture-Zivoe-Vault', '../..', 'fixture?x=1']) {
      const malformed: Registration = { ...fixture, zivoeVault: { ...fixture.zivoeVault, slug } };
      expect(() => assertRegistry([malformed])).toThrow(/kebab-case/);
    }
  });

  it('throws when a share class claims a deposit asset symbol, compared case-insensitively', () => {
    const usdc: Registration = { ...fixture, catalogEntry: { ...fixture.catalogEntry, symbol: 'usdc' } };
    expect(() => assertRegistry([usdc])).toThrow(/deposit asset/);
  });

  it('throws when two Zivoe Vaults register the same share class', () => {
    // A case variant on purpose: the record itself cannot hold an exact
    // duplicate key, so the case-insensitive sweep is the reachable guard.
    const duplicate: Registration = {
      ...other,
      zivoeVault: { ...other.zivoeVault, shareClass: { key: FIXTURE_SHARE_CLASS.key.toUpperCase() } }
    };

    expect(() =>
      assertZivoeVaultRegistryInvariants({
        zivoeVaults: {
          [fixture.zivoeVault.shareClass.key]: fixture.zivoeVault,
          [duplicate.zivoeVault.shareClass.key]: duplicate.zivoeVault
        },
        catalog: { [FIXTURE_SHARE_CLASS.key]: fixture.catalogEntry }
      })
    ).toThrow(/registered by two Zivoe Vaults/);
  });

  it('throws when the record key disagrees with the module it registers', () => {
    expect(() =>
      assertZivoeVaultRegistryInvariants({ zivoeVaults: { wrong: fixture.zivoeVault }, catalog: {} })
    ).toThrow(/registered under "wrong"/);
  });

  it('throws when a Zivoe Vault references a share class the catalog does not know', () => {
    expect(() =>
      assertZivoeVaultRegistryInvariants({
        zivoeVaults: { [fixture.zivoeVault.shareClass.key]: fixture.zivoeVault },
        catalog: {}
      })
    ).toThrow(/not in the catalog/);
  });

  it('throws the not-in-catalog error for a prototype-chain key, not a TypeError', () => {
    expect(() =>
      assertZivoeVaultRegistryInvariants({
        zivoeVaults: { toString: { slug: 'ghost-zivoe-vault', shareClass: { key: 'toString' }, centrifugeVaults: {} } },
        catalog: {}
      })
    ).toThrow(/not in the catalog/);
  });

  it('throws on a half-claimed network, in both directions', () => {
    const catalogOnly: Registration = {
      ...other,
      zivoeVault: { ...other.zivoeVault, centrifugeVaults: {} }
    };
    expect(() => assertRegistry([catalogOnly])).toThrow(
      /claims "sepolia" in the catalog but not its Centrifuge vaults/
    );

    const centrifugeVaultOnly: Registration = {
      ...other,
      catalogEntry: { ...other.catalogEntry, networks: {} }
    };
    expect(() => assertRegistry([centrifugeVaultOnly])).toThrow(
      /claims "sepolia" in its Centrifuge vaults but not the catalog/
    );
  });

  it('throws when the catalog and Centrifuge-vault deployable flags disagree, in both directions', () => {
    const sepoliaCentrifugeVault = other.zivoeVault.centrifugeVaults.sepolia;
    const sepoliaEntry = other.catalogEntry.networks.sepolia;
    if (!sepoliaCentrifugeVault || !sepoliaEntry) throw new Error('the "other" registration must claim sepolia');

    // The exact staging state a mainnet cutover passes through: one half
    // flipped live, the other still a verified-but-staged entry.
    const catalogLiveCentrifugeVaultStaged: Registration = {
      ...other,
      zivoeVault: {
        ...other.zivoeVault,
        centrifugeVaults: { sepolia: { address: sepoliaCentrifugeVault.address, deployable: false } }
      }
    };
    expect(() => assertRegistry([catalogLiveCentrifugeVaultStaged])).toThrow(
      /catalog-deployable but its Centrifuge vault is not/
    );

    const centrifugeVaultLiveCatalogStaged: Registration = {
      ...other,
      catalogEntry: {
        ...other.catalogEntry,
        networks: { sepolia: { ...sepoliaEntry, deployable: false } }
      }
    };
    expect(() => assertRegistry([centrifugeVaultLiveCatalogStaged])).toThrow(
      /Centrifuge-vault-deployable but its catalog entry is not/
    );
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

    const flippedCentrifugeVault: Registration = {
      ...other,
      zivoeVault: { ...other.zivoeVault, centrifugeVaults: { sepolia: { address: ZERO_ADDRESS, deployable: true } } }
    };
    expect(() => assertRegistry([flippedCentrifugeVault])).toThrow(/deployable but carries a placeholder address/);
  });

  it('throws when two share classes share a Centrifuge vault, compared case-insensitively', () => {
    expect(() =>
      assertRegistry([
        fixture,
        {
          ...other,
          zivoeVault: {
            ...other.zivoeVault,
            // Case-shifted on purpose: identity comparisons must be case-insensitive.
            centrifugeVaults: {
              sepolia: { address: FIXTURE_SHARE_CLASS.centrifugeVaultAddress.toUpperCase(), deployable: true }
            }
          }
        }
      ])
    ).toThrow(/Centrifuge vault .* is claimed by two share classes/);
  });

  it('throws on a duplicate Centrifuge vault on a non-active network — the sweep covers every claimed network', () => {
    const onMainnet = (registration: Registration, index: number): Registration => ({
      zivoeVault: {
        ...registration.zivoeVault,
        centrifugeVaults: {
          ...registration.zivoeVault.centrifugeVaults,
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
      /Centrifuge vault .* is claimed by two share classes on "mainnet"/
    );
  });
});
