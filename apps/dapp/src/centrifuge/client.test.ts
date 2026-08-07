// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { type TransactedShareClass } from './types';

const sdk = vi.hoisted(() => ({
  id: vi.fn(),
  pool: vi.fn(),
  setSigner: vi.fn()
}));

// Pulled in via @/lib/utils; its UI toast import does not transform under vitest.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

vi.mock('@centrifuge/sdk', () => ({
  default: class {
    id = sdk.id;
    pool = sdk.pool;
    setSigner = sdk.setSigner;
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
  vaultAddress: '0xbebebebebebebebebebebebebebebebebebebebe'
};

function fakeSdkVault({
  address,
  isSyncDeposit = true,
  isSyncRedeem = false
}: {
  address: string;
  isSyncDeposit?: boolean;
  isSyncRedeem?: boolean;
}) {
  return {
    address,
    details: () => Promise.resolve({ isSyncDeposit, isSyncRedeem })
  };
}

/** Vaults keyed by scId, so each share class resolves its own instance. */
function poolWithVaults(vaultsByScId: Record<string, unknown>) {
  return {
    vault: vi.fn((_centrifugeId: number, scId: { value: string }) => Promise.resolve(vaultsByScId[scId.value]))
  };
}

/** Fresh module state per test — the vault memo is module-level. */
async function loadClient() {
  vi.resetModules();
  return import('./client');
}

beforeEach(() => {
  vi.clearAllMocks();
  sdk.id.mockResolvedValue(3);
});

describe('getVault', () => {
  it('resolves per share class, memoizing each and asserting the configured address', async () => {
    const pool = poolWithVaults({
      // Uppercase on purpose: the address equality must be case-insensitive.
      [SHARE_CLASS.scId]: fakeSdkVault({ address: SHARE_CLASS.vaultAddress.toUpperCase().replace('0X', '0x') }),
      [OTHER_SHARE_CLASS.scId]: fakeSdkVault({ address: OTHER_SHARE_CLASS.vaultAddress })
    });
    sdk.pool.mockResolvedValue(pool);

    const { getVault } = await loadClient();

    const [first, again, other] = await Promise.all([
      getVault(SHARE_CLASS),
      getVault(SHARE_CLASS),
      getVault(OTHER_SHARE_CLASS)
    ]);

    expect(first).toBe(again);
    expect(first).not.toBe(other);
    expect(other.address).toBe(OTHER_SHARE_CLASS.vaultAddress);
    // One resolution per share class, each against its own scId.
    expect(pool.vault).toHaveBeenCalledTimes(2);
    expect(pool.vault).toHaveBeenCalledWith(3, expect.objectContaining({ value: SHARE_CLASS.scId }), expect.anything());
    expect(pool.vault).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ value: OTHER_SHARE_CLASS.scId }),
      expect.anything()
    );
  });

  it('fails loudly when the SDK resolves a different vault than configured, then retries', async () => {
    const wrongVault = fakeSdkVault({ address: '0x1111111111111111111111111111111111111111' });
    const rightVault = fakeSdkVault({ address: SHARE_CLASS.vaultAddress });
    const pool = poolWithVaults({ [SHARE_CLASS.scId]: wrongVault });
    sdk.pool.mockResolvedValue(pool);

    const { getVault } = await loadClient();

    await expect(getVault(SHARE_CLASS)).rejects.toThrow(/is configured/);

    // The failed promise is not memoized — the next call resolves fresh.
    pool.vault.mockImplementation(() => Promise.resolve(rightVault));
    await expect(getVault(SHARE_CLASS)).resolves.toBe(rightVault);
  });

  it('fails loudly when the vault is not sync-deposit/async-redeem', async () => {
    const asyncDepositVault = fakeSdkVault({ address: SHARE_CLASS.vaultAddress, isSyncDeposit: false });
    sdk.pool.mockResolvedValue(poolWithVaults({ [SHARE_CLASS.scId]: asyncDepositVault }));

    const { getVault } = await loadClient();

    await expect(getVault(SHARE_CLASS)).rejects.toThrow(/sync-deposit\/async-redeem/);
  });
});
