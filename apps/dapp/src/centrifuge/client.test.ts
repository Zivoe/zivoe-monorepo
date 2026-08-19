// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { type TransactedShareClass } from './types';

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

const SHARE_CLASS = FIXTURE_IDENTITY.shareClass;

const OTHER_SHARE_CLASS: TransactedShareClass = {
  ...SHARE_CLASS,
  key: 'other',
  scId: '0x000100000000eeee0000000000000001',
  centrifugeVaultAddress: '0xbebebebebebebebebebebebebebebebebebebebe'
};

function fakeSdkCentrifugeVault({
  address,
  isSyncDeposit = true,
  isSyncRedeem = false,
  shareDecimals = SHARE_CLASS.decimals,
  shareTokenAddress = SHARE_CLASS.shareTokenAddress,
  assetDecimals = SHARE_CLASS.usdc.decimals
}: {
  address: string;
  isSyncDeposit?: boolean;
  isSyncRedeem?: boolean;
  shareDecimals?: number;
  shareTokenAddress?: string;
  assetDecimals?: number;
}) {
  return {
    address,
    details: () =>
      Promise.resolve({
        isSyncDeposit,
        isSyncRedeem,
        share: { address: shareTokenAddress, decimals: shareDecimals },
        asset: { decimals: assetDecimals }
      })
  };
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
  sdk.protocolAddresses.mockResolvedValue({ vaultRouter: SHARE_CLASS.vaultRouterAddress });
});

describe('getCentrifugeVault', () => {
  it('resolves per share class, memoizing each and asserting the configured address', async () => {
    const pool = poolWithCentrifugeVaults({
      // Uppercase on purpose: the address equality must be case-insensitive.
      [SHARE_CLASS.scId]: fakeSdkCentrifugeVault({
        address: SHARE_CLASS.centrifugeVaultAddress.toUpperCase().replace('0X', '0x')
      }),
      [OTHER_SHARE_CLASS.scId]: fakeSdkCentrifugeVault({ address: OTHER_SHARE_CLASS.centrifugeVaultAddress })
    });
    sdk.pool.mockResolvedValue(pool);

    const { getCentrifugeVault } = await loadClient();

    const [first, again, other] = await Promise.all([
      getCentrifugeVault(SHARE_CLASS),
      getCentrifugeVault(SHARE_CLASS),
      getCentrifugeVault(OTHER_SHARE_CLASS)
    ]);

    expect(first).toBe(again);
    expect(first).not.toBe(other);
    expect(other.address).toBe(OTHER_SHARE_CLASS.centrifugeVaultAddress);
    // One resolution per share class, each against its own scId.
    expect(pool.vault).toHaveBeenCalledTimes(2);
    expect(pool.vault).toHaveBeenCalledWith(3, expect.objectContaining({ value: SHARE_CLASS.scId }), expect.anything());
    expect(pool.vault).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ value: OTHER_SHARE_CLASS.scId }),
      expect.anything()
    );
  });

  it('fails loudly when the SDK resolves a different Centrifuge vault than configured, then retries', async () => {
    const wrongCentrifugeVault = fakeSdkCentrifugeVault({ address: '0x1111111111111111111111111111111111111111' });
    const rightCentrifugeVault = fakeSdkCentrifugeVault({ address: SHARE_CLASS.centrifugeVaultAddress });
    const pool = poolWithCentrifugeVaults({ [SHARE_CLASS.scId]: wrongCentrifugeVault });
    sdk.pool.mockResolvedValue(pool);

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(SHARE_CLASS)).rejects.toThrow(/is configured/);

    // The failed promise is not memoized — the next call resolves fresh.
    pool.vault.mockImplementation(() => Promise.resolve(rightCentrifugeVault));
    await expect(getCentrifugeVault(SHARE_CLASS)).resolves.toBe(rightCentrifugeVault);
  });

  it('fails loudly when the Centrifuge vault is not sync-deposit/async-redeem', async () => {
    const asyncDepositCentrifugeVault = fakeSdkCentrifugeVault({
      address: SHARE_CLASS.centrifugeVaultAddress,
      isSyncDeposit: false
    });
    sdk.pool.mockResolvedValue(poolWithCentrifugeVaults({ [SHARE_CLASS.scId]: asyncDepositCentrifugeVault }));

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(SHARE_CLASS)).rejects.toThrow(/sync-deposit\/async-redeem/);
  });

  it('fails loudly when the catalog decimals disagree with the share token on chain', async () => {
    const vault = fakeSdkCentrifugeVault({
      address: SHARE_CLASS.centrifugeVaultAddress,
      shareDecimals: SHARE_CLASS.decimals + 10
    });
    sdk.pool.mockResolvedValue(poolWithCentrifugeVaults({ [SHARE_CLASS.scId]: vault }));

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(SHARE_CLASS)).rejects.toThrow(/Fix the catalog before transacting/);
  });

  it('fails loudly when the catalog share token address disagrees with the Centrifuge vault on chain', async () => {
    // The scId-filtered hub reads never touch this address, so this assertion
    // is the only automated check a catalog shareTokenAddress gets.
    const vault = fakeSdkCentrifugeVault({
      address: SHARE_CLASS.centrifugeVaultAddress,
      shareTokenAddress: '0xdddddddddddddddddddddddddddddddddddddddd'
    });
    sdk.pool.mockResolvedValue(poolWithCentrifugeVaults({ [SHARE_CLASS.scId]: vault }));

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(SHARE_CLASS)).rejects.toThrow(/but the Centrifuge vault reports/);
  });

  it('fails loudly when the configured USDC decimals disagree with the Centrifuge-vault asset on chain', async () => {
    const vault = fakeSdkCentrifugeVault({ address: SHARE_CLASS.centrifugeVaultAddress, assetDecimals: 18 });
    sdk.pool.mockResolvedValue(poolWithCentrifugeVaults({ [SHARE_CLASS.scId]: vault }));

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(SHARE_CLASS)).rejects.toThrow(/Fix the chain config before transacting/);
  });

  it('fails loudly when the configured VaultRouter disagrees with the SDK protocol addresses', async () => {
    // The router is the USDC approval spender; nothing downstream validates
    // it before an approval is signed, so resolution must.
    sdk.protocolAddresses.mockResolvedValue({ vaultRouter: '0x9999999999999999999999999999999999999999' });
    sdk.pool.mockResolvedValue(
      poolWithCentrifugeVaults({
        [SHARE_CLASS.scId]: fakeSdkCentrifugeVault({ address: SHARE_CLASS.centrifugeVaultAddress })
      })
    );

    const { getCentrifugeVault } = await loadClient();

    await expect(getCentrifugeVault(SHARE_CLASS)).rejects.toThrow(/but the SDK reports/);
    expect(sdk.protocolAddresses).toHaveBeenCalledWith(3);
  });

  it("never lets one key's cached Centrifuge vault answer for a different Centrifuge-vault address", async () => {
    sdk.pool.mockResolvedValue(
      poolWithCentrifugeVaults({
        [SHARE_CLASS.scId]: fakeSdkCentrifugeVault({ address: SHARE_CLASS.centrifugeVaultAddress })
      })
    );

    const { getCentrifugeVault } = await loadClient();
    await expect(getCentrifugeVault(SHARE_CLASS)).resolves.toBeTruthy();

    // Same key, different Centrifuge vault: the memo must miss so the address assertion
    // runs — a key-only memo would silently return the cached Centrifuge vault.
    const rewired = { ...SHARE_CLASS, centrifugeVaultAddress: OTHER_SHARE_CLASS.centrifugeVaultAddress };
    await expect(getCentrifugeVault(rewired)).rejects.toThrow(/is configured/);
  });
});
