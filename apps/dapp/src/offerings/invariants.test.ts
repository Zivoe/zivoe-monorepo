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
    shareClass: { key: string; symbol: string };
    vaults: Partial<Record<NetworkName, { address: string; deployable: boolean }>>;
  };
  catalogEntry: {
    networks: Partial<
      Record<NetworkName, { poolId: string; scId: string; shareTokenAddress: string; deployable: boolean }>
    >;
  };
};

/** One registered class — the module half and its catalog half, live on sepolia. */
function makeRegistration({
  key,
  symbol,
  slug = `${key}-offering`,
  scId,
  shareTokenAddress,
  vaultAddress
}: {
  key: string;
  symbol: string;
  slug?: string;
  scId: string;
  shareTokenAddress: string;
  vaultAddress: string;
}): Registration {
  return {
    offering: {
      slug,
      shareClass: { key, symbol },
      vaults: { sepolia: { address: vaultAddress, deployable: true } }
    },
    catalogEntry: {
      networks: { sepolia: { poolId: '77', scId, shareTokenAddress, deployable: true } }
    }
  };
}

function assertRegistry(registrations: Array<Registration>) {
  assertOfferingRegistryInvariants({
    offerings: registrations.map((registration) => registration.offering),
    catalog: Object.fromEntries(
      registrations.map((registration) => [registration.offering.shareClass.key, registration.catalogEntry])
    )
  });
}

const fixture = makeRegistration({
  key: FIXTURE_SHARE_CLASS.key,
  symbol: FIXTURE_SHARE_CLASS.symbol,
  slug: 'fixture-offering',
  scId: FIXTURE_SHARE_CLASS.scId,
  shareTokenAddress: FIXTURE_SHARE_CLASS.shareTokenAddress,
  vaultAddress: FIXTURE_SHARE_CLASS.vaultAddress
});

const other = makeRegistration({
  key: 'other',
  symbol: 'zOTH',
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

  it('throws on a duplicate slug', () => {
    expect(() =>
      assertRegistry([fixture, { ...other, offering: { ...other.offering, slug: fixture.offering.slug } }])
    ).toThrow(/Duplicate Offering slug/);
  });

  it('throws when two Offerings register the same share class', () => {
    const duplicate: Registration = {
      ...other,
      offering: { ...other.offering, shareClass: { ...other.offering.shareClass, key: FIXTURE_SHARE_CLASS.key } }
    };

    expect(() =>
      assertOfferingRegistryInvariants({
        offerings: [fixture.offering, duplicate.offering],
        catalog: { [FIXTURE_SHARE_CLASS.key]: fixture.catalogEntry }
      })
    ).toThrow(/registered by two Offerings/);
  });

  it('throws when two Offerings share a token symbol', () => {
    expect(() =>
      assertRegistry([
        fixture,
        {
          ...other,
          offering: {
            ...other.offering,
            shareClass: { ...other.offering.shareClass, symbol: FIXTURE_SHARE_CLASS.symbol }
          }
        }
      ])
    ).toThrow(/symbol .* is claimed by two Offerings/);
  });

  it('throws when an Offering references a share class the catalog does not know', () => {
    expect(() => assertOfferingRegistryInvariants({ offerings: [fixture.offering], catalog: {} })).toThrow(
      /not in the catalog/
    );
  });

  it('throws on a half-claimed network, in both directions', () => {
    const catalogOnly: Registration = {
      ...other,
      offering: { ...other.offering, vaults: {} }
    };
    expect(() => assertRegistry([catalogOnly])).toThrow(/claims "sepolia" in the catalog but not its vaults/);

    const vaultOnly: Registration = {
      ...other,
      catalogEntry: { networks: {} }
    };
    expect(() => assertRegistry([vaultOnly])).toThrow(/claims "sepolia" in its vaults but not the catalog/);
  });

  it('throws on placeholder values under a deployable flag', () => {
    const flippedCatalog: Registration = {
      ...other,
      catalogEntry: {
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

  it('throws on duplicate on-chain identities, including on a non-active network', () => {
    // Both classes are fine on sepolia but collide on mainnet — the sweep must
    // fail every build, not only the mainnet one.
    const onMainnet = (registration: Registration, scId: string): Registration => ({
      offering: {
        ...registration.offering,
        vaults: {
          ...registration.offering.vaults,
          mainnet: {
            address: `0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa${registration.offering.slug.length}0`,
            deployable: true
          }
        }
      },
      catalogEntry: {
        networks: {
          ...registration.catalogEntry.networks,
          mainnet: {
            poolId: '99',
            scId,
            shareTokenAddress: `0xcccccccccccccccccccccccccccccccccccccc${registration.offering.slug.length}0`,
            deployable: true
          }
        }
      }
    });

    const collidingScId = '0x000100000000dddd0000000000000001';
    expect(() => assertRegistry([onMainnet(fixture, collidingScId), onMainnet(other, collidingScId)])).toThrow(
      /claimed by two catalog entries on "mainnet"/
    );
  });

  it('compares identities case-insensitively', () => {
    expect(() =>
      assertRegistry([
        fixture,
        {
          ...other,
          catalogEntry: {
            networks: {
              sepolia: {
                poolId: '77',
                scId: '0x000100000000eeee0000000000000001',
                // Case-shifted on purpose: identity comparisons must be case-insensitive.
                shareTokenAddress: FIXTURE_SHARE_CLASS.shareTokenAddress.toUpperCase(),
                deployable: true
              }
            }
          }
        }
      ])
    ).toThrow(/Share token .* is claimed by two share classes/);
  });

  it('throws when two share classes share a vault', () => {
    expect(() =>
      assertRegistry([
        fixture,
        {
          ...other,
          offering: {
            ...other.offering,
            vaults: { sepolia: { address: FIXTURE_SHARE_CLASS.vaultAddress, deployable: true } }
          }
        }
      ])
    ).toThrow(/Vault .* is claimed by two share classes/);
  });
});
