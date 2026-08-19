import { describe, expect, it } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { assertZivoeVaultRegistryInvariants } from './invariants';

const FIXTURE_SHARE_CLASS = FIXTURE_IDENTITY.shareClass;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_SC_ID = '0x00000000000000000000000000000000';

type ChainName = 'sepolia' | 'base-sepolia' | 'ethereum' | 'monad';

type Registration = {
  zivoeVault: {
    slug: string;
    shareClass: { key: string };
    centrifugeVaults: Partial<Record<ChainName, { address: string; deployable: boolean }>>;
  };
  catalogEntry: {
    symbol: string;
    environments: Partial<
      Record<
        'testnet' | 'mainnet',
        {
          poolId: string;
          scId: string;
          chains: Partial<Record<ChainName, { shareTokenAddress: string; deployable: boolean }>>;
        }
      >
    >;
  };
};

/** One registered class — the module half and its catalog half, live on sepolia (testnet). */
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
      environments: {
        testnet: { poolId: '77', scId, chains: { sepolia: { shareTokenAddress, deployable: true } } }
      }
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
  it('accepts a registry of distinct identities, including shared placeholder zeros on a staged chain', () => {
    const staged = (registration: Registration): Registration => ({
      zivoeVault: {
        ...registration.zivoeVault,
        centrifugeVaults: {
          ...registration.zivoeVault.centrifugeVaults,
          ethereum: { address: ZERO_ADDRESS, deployable: false }
        }
      },
      catalogEntry: {
        ...registration.catalogEntry,
        environments: {
          ...registration.catalogEntry.environments,
          mainnet: {
            poolId: '0',
            scId: ZERO_SC_ID,
            chains: { ethereum: { shareTokenAddress: ZERO_ADDRESS, deployable: false } }
          }
        }
      }
    });

    expect(() => assertRegistry([staged(fixture), staged(other)])).not.toThrow();
  });

  it('accepts a testnet-only class next to one also claiming a mainnet chain', () => {
    const withEthereum: Registration = {
      zivoeVault: {
        ...other.zivoeVault,
        centrifugeVaults: {
          ...other.zivoeVault.centrifugeVaults,
          ethereum: { address: '0xadadadadadadadadadadadadadadadadadadadad', deployable: true }
        }
      },
      catalogEntry: {
        ...other.catalogEntry,
        environments: {
          ...other.catalogEntry.environments,
          mainnet: {
            poolId: '88',
            scId: '0x000100000000ffff0000000000000001',
            chains: {
              ethereum: { shareTokenAddress: '0xfafafafafafafafafafafafafafafafafafafafa', deployable: true }
            }
          }
        }
      }
    };

    expect(() => assertRegistry([fixture, withEthereum])).not.toThrow();
  });

  it('accepts one Centrifuge-vault address reused across two chains — deterministic deploys are legitimate', () => {
    const centrifugeVaultAddress = other.zivoeVault.centrifugeVaults.sepolia?.address;
    const onEnvironment = other.catalogEntry.environments.testnet;
    if (!centrifugeVaultAddress || !onEnvironment) throw new Error('the "other" registration must claim sepolia');

    const twoChains: Registration = {
      zivoeVault: {
        ...other.zivoeVault,
        centrifugeVaults: {
          sepolia: { address: centrifugeVaultAddress, deployable: true },
          'base-sepolia': { address: centrifugeVaultAddress, deployable: true }
        }
      },
      catalogEntry: {
        ...other.catalogEntry,
        environments: {
          testnet: {
            ...onEnvironment,
            chains: {
              ...onEnvironment.chains,
              'base-sepolia': { shareTokenAddress: '0xdadadadadadadadadadadadadadadadadadadada', deployable: true }
            }
          }
        }
      }
    };

    expect(() => assertRegistry([twoChains])).not.toThrow();
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

  it('throws on a half-claimed chain, in both directions', () => {
    const catalogOnly: Registration = {
      ...other,
      zivoeVault: { ...other.zivoeVault, centrifugeVaults: {} }
    };
    expect(() => assertRegistry([catalogOnly])).toThrow(
      /claims "sepolia" in the catalog but not its Centrifuge vaults/
    );

    const centrifugeVaultOnly: Registration = {
      ...other,
      catalogEntry: { ...other.catalogEntry, environments: {} }
    };
    expect(() => assertRegistry([centrifugeVaultOnly])).toThrow(
      /claims "sepolia" in its Centrifuge vaults but not the catalog/
    );
  });

  it('throws when the catalog and Centrifuge-vault deployable flags disagree, in both directions', () => {
    const sepoliaCentrifugeVault = other.zivoeVault.centrifugeVaults.sepolia;
    const onEnvironment = other.catalogEntry.environments.testnet;
    const sepoliaEntry = onEnvironment?.chains.sepolia;
    if (!sepoliaCentrifugeVault || !onEnvironment || !sepoliaEntry)
      throw new Error('the "other" registration must claim sepolia');

    // The exact staging state a cutover passes through: one half flipped
    // live, the other still a verified-but-staged entry.
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
        environments: {
          testnet: { ...onEnvironment, chains: { sepolia: { ...sepoliaEntry, deployable: false } } }
        }
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
        environments: {
          testnet: {
            poolId: '0',
            scId: ZERO_SC_ID,
            chains: { sepolia: { shareTokenAddress: ZERO_ADDRESS, deployable: true } }
          }
        }
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

  it('throws on a duplicate Centrifuge vault on a non-active chain — the sweep covers every claimed chain', () => {
    const onEthereum = (registration: Registration, index: number): Registration => ({
      zivoeVault: {
        ...registration.zivoeVault,
        centrifugeVaults: {
          ...registration.zivoeVault.centrifugeVaults,
          ethereum: { address: '0xadadadadadadadadadadadadadadadadadadadad', deployable: true }
        }
      },
      catalogEntry: {
        ...registration.catalogEntry,
        environments: {
          ...registration.catalogEntry.environments,
          mainnet: {
            poolId: '99',
            scId: `0x000100000000dddd000000000000000${index}`,
            chains: {
              ethereum: {
                shareTokenAddress: `0xcccccccccccccccccccccccccccccccccccccc${index}0`,
                deployable: true
              }
            }
          }
        }
      }
    });

    expect(() => assertRegistry([onEthereum(fixture, 1), onEthereum(other, 2)])).toThrow(
      /Centrifuge vault .* is claimed by two share classes on "ethereum"/
    );
  });
});
