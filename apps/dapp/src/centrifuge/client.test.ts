// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { type TransactedCentrifugeVault } from './types';

const sdk = vi.hoisted(() => ({
  id: vi.fn(),
  pool: vi.fn(),
  setSigner: vi.fn(),
  protocolAddresses: vi.fn()
}));

// Pulled in via @/lib/utils; its UI toast import does not transform under vitest.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

vi.mock('@centrifuge/sdk', () => ({
  default: class {
    id = sdk.id;
    pool = sdk.pool;
    setSigner = sdk.setSigner;
    _protocolAddresses = sdk.protocolAddresses;
  },
  PoolId: class {
    constructor(public readonly value: string) {}
  },
  ShareClassId: class {
    constructor(public readonly value: string) {}
  }
}));

const CENTRIFUGE_VAULT = FIXTURE_IDENTITY.centrifugeVault;
// The chain's AsyncRequestManager as the protocol addresses report it — handed to the entity at resolution.
const MANAGER_ADDRESS = '0x00000000000000000000000000000000000000bb';

const OTHER_CENTRIFUGE_VAULT: TransactedCentrifugeVault = {
  ...CENTRIFUGE_VAULT,
  address: '0xbebebebebebebebebebebebebebebebebebebebe',
  shareClass: { ...CENTRIFUGE_VAULT.shareClass, key: 'other', scId: '0x000100000000eeee0000000000000001' }
};

/** The SDK entity, reduced to what resolution reads off it: the resolved address. */
function fakeSdkCentrifugeVault({ address }: { address: string }) {
  return { address, details: () => Promise.resolve({}) };
}

/** Centrifuge vaults keyed by scId, so each share class resolves its own instance. */
function poolWithCentrifugeVaults(centrifugeVaultsByScId: Record<string, unknown>) {
  return {
    vault: vi.fn((_centrifugeId: number, scId: { value: string }) =>
      Promise.resolve(centrifugeVaultsByScId[scId.value])
    )
  };
}

/** Fresh module state per test — the Centrifuge-vault memo is module-level. */
async function loadClient() {
  vi.resetModules();
  return import('./client');
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.id.mockResolvedValue(3);
  sdk.protocolAddresses.mockResolvedValue({
    vaultRouter: CENTRIFUGE_VAULT.vaultRouterAddress,
    asyncRequestManager: MANAGER_ADDRESS
  });
});

describe('getCentrifugeVault', () => {
  it('resolves per share class, memoizing each and asserting the configured address', async () => {
    const pool = poolWithCentrifugeVaults({
      // Uppercase on purpose: the address equality must be case-insensitive.
      [CENTRIFUGE_VAULT.shareClass.scId]: fakeSdkCentrifugeVault({
        address: CENTRIFUGE_VAULT.address.toUpperCase().replace('0X', '0x')
      }),
      [OTHER_CENTRIFUGE_VAULT.shareClass.scId]: fakeSdkCentrifugeVault({ address: OTHER_CENTRIFUGE_VAULT.address })
    });
    sdk.pool.mockResolvedValue(pool);

    const { getCentrifugeVault } = await loadClient();

    const [first, again, other] = await Promise.all([
      getCentrifugeVault(CENTRIFUGE_VAULT),
      getCentrifugeVault(CENTRIFUGE_VAULT),
      getCentrifugeVault(OTHER_CENTRIFUGE_VAULT)
    ]);

    expect(first).toBe(again);
    expect(first).not.toBe(other);
    expect(other.address).toBe(OTHER_CENTRIFUGE_VAULT.address);
    // One resolution per share class, each against its own scId.
    expect(pool.vault).toHaveBeenCalledTimes(2);
    expect(pool.vault).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ value: CENTRIFUGE_VAULT.shareClass.scId }),
      expect.anything()
    );
    expect(pool.vault).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ value: OTHER_CENTRIFUGE_VAULT.shareClass.scId }),
      expect.anything()
    );
    // The router lookup is keyed by the resolved centrifugeId, never the EVM
    // chain id — the two coincide only for ethereum.
    expect(sdk.protocolAddresses).toHaveBeenCalledWith(3);
  });

  it('fails loudly when the SDK resolves a different Centrifuge vault than configured, then retries', async () => {
    const wrongCentrifugeVault = fakeSdkCentrifugeVault({ address: '0x1111111111111111111111111111111111111111' });
    const rightCentrifugeVault = fakeSdkCentrifugeVault({ address: CENTRIFUGE_VAULT.address });
    const pool = poolWithCentrifugeVaults({ [CENTRIFUGE_VAULT.shareClass.scId]: wrongCentrifugeVault });
    sdk.pool.mockResolvedValue(pool);

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(CENTRIFUGE_VAULT)).rejects.toThrow(/is configured/);

    // The failed promise is not memoized — the next call resolves fresh.
    pool.vault.mockImplementation(() => Promise.resolve(rightCentrifugeVault));
    await expect(getCentrifugeVault(CENTRIFUGE_VAULT)).resolves.toBe(rightCentrifugeVault);
  });

  it('fails loudly when the protocol reports a different VaultRouter than the configured approval spender', async () => {
    sdk.pool.mockResolvedValue(
      poolWithCentrifugeVaults({
        [CENTRIFUGE_VAULT.shareClass.scId]: fakeSdkCentrifugeVault({ address: CENTRIFUGE_VAULT.address })
      })
    );
    // The router is protocol-level: Centrifuge can migrate it with no deploy
    // on our side, which is exactly the drift this assertion exists to catch.
    sdk.protocolAddresses.mockResolvedValue({
      vaultRouter: '0x2222222222222222222222222222222222222222',
      asyncRequestManager: MANAGER_ADDRESS
    });

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(CENTRIFUGE_VAULT)).rejects.toThrow(/VaultRouter/);
  });

  it('fails loudly when the SDK dropped the VaultRouter instead of crashing on the missing field', async () => {
    sdk.pool.mockResolvedValue(
      poolWithCentrifugeVaults({
        [CENTRIFUGE_VAULT.shareClass.scId]: fakeSdkCentrifugeVault({ address: CENTRIFUGE_VAULT.address })
      })
    );
    // On an allowlist mismatch the SDK deletes the field rather than throwing,
    // so "missing" IS the router-migration signal — it must surface as the
    // explicit mismatch error, not a TypeError on toLowerCase.
    sdk.protocolAddresses.mockResolvedValue({ vaultRouter: undefined, asyncRequestManager: MANAGER_ADDRESS });

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(CENTRIFUGE_VAULT)).rejects.toThrow(/dropped the indexer-reported VaultRouter/);
  });

  it('fails loudly when the SDK drops the AsyncRequestManager the Unfunded Claim read depends on', async () => {
    sdk.pool.mockResolvedValue(
      poolWithCentrifugeVaults({
        [CENTRIFUGE_VAULT.shareClass.scId]: fakeSdkCentrifugeVault({ address: CENTRIFUGE_VAULT.address })
      })
    );
    sdk.protocolAddresses.mockResolvedValue({
      vaultRouter: CENTRIFUGE_VAULT.vaultRouterAddress,
      asyncRequestManager: undefined
    });

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(CENTRIFUGE_VAULT)).rejects.toThrow(
      /dropped the indexer-reported AsyncRequestManager/
    );
  });

  it('hands the entity the AsyncRequestManager it resolved', async () => {
    sdk.pool.mockResolvedValue(
      poolWithCentrifugeVaults({
        [CENTRIFUGE_VAULT.shareClass.scId]: fakeSdkCentrifugeVault({ address: CENTRIFUGE_VAULT.address })
      })
    );

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(CENTRIFUGE_VAULT)).resolves.toMatchObject({
      asyncRequestManagerAddress: MANAGER_ADDRESS
    });
  });

  it("never lets one key's cached Centrifuge vault answer for a different Centrifuge-vault address", async () => {
    sdk.pool.mockResolvedValue(
      poolWithCentrifugeVaults({
        [CENTRIFUGE_VAULT.shareClass.scId]: fakeSdkCentrifugeVault({ address: CENTRIFUGE_VAULT.address })
      })
    );

    const { getCentrifugeVault } = await loadClient();
    await expect(getCentrifugeVault(CENTRIFUGE_VAULT)).resolves.toBeTruthy();

    // Same key, different Centrifuge vault: the memo must miss so the address assertion
    // runs — a key-only memo would silently return the cached Centrifuge vault.
    const rewired = { ...CENTRIFUGE_VAULT, address: OTHER_CENTRIFUGE_VAULT.address };
    await expect(getCentrifugeVault(rewired)).rejects.toThrow(/is configured/);
  });
});
