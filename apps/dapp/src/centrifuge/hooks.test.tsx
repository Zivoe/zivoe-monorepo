// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { useDepositPreview, useInvestorWhitelist, useRedemptionPosition, useVaultCapacity } from './index';

const getVault = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getVault }));

const readContract = vi.hoisted(() => vi.fn());
vi.mock('wagmi', () => ({ usePublicClient: () => ({ readContract }) }));

const useAccount = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAccount', () => ({ useAccount }));

// The public entry also exports the transaction hooks, whose UI toast import
// does not transform under vitest; these tests never render toasts.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const INVESTOR = '0xa28ef80d690844b586e192690d8fcdaecfd0281e';

const SHARE_CLASS = FIXTURE_IDENTITY.shareClass;

function balance(value: bigint, decimals = 18) {
  return { toBigInt: () => value, decimals };
}

// The whitelist fixture stays in the SDK's own deposit/redeem vocabulary —
// the rename to canReceiveShares/canRequestRedemption happens in the read, and
// a fixture written in domain terms would assert the mapping against itself.
function fakeVault({ whitelist = { isAllowedToDeposit: true, isAllowedToRedeem: true } } = {}) {
  return {
    details: () => Promise.resolve({ maxDeposit: balance(5_000_000000n, 6) }),
    investment: () =>
      Promise.resolve({
        ...whitelist,
        shareBalance: balance(101_000000000000000000n),
        pendingRedeemShares: balance(200_000000000000000000n),
        claimableRedeemAssets: balance(150_000000n, 6),
        claimableRedeemSharesEquivalent: balance(140_000000000000000000n),
        claimableCancelRedeemShares: balance(60_000000000000000000n),
        hasPendingCancelRedeemRequest: false
      })
  };
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  getVault.mockImplementation(() => Promise.resolve(fakeVault()));
  readContract.mockResolvedValue(50_000000000000000000n);
  useAccount.mockReturnValue({ isPending: false, isDisconnected: false, address: INVESTOR });
});

describe('useVaultCapacity', () => {
  it('reads the handed share class vault and caches under its key', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useVaultCapacity({ shareClass: SHARE_CLASS }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ maxDeposit: 5_000_000000n });
    expect(getVault).toHaveBeenCalledWith(SHARE_CLASS);
    expect(queryClient.getQueryData(['CENTRIFUGE', 'zfix', SHARE_CLASS.vaultAddress, 'VAULT_CAPACITY'])).toEqual({
      maxDeposit: 5_000_000000n
    });
  });

  // The reason the key carries the address: one share class can carry several
  // vaults (one per network today, one per deposit asset later), and each
  // answers maxDeposit for itself. A class-only key would serve the first
  // vault's capacity for the second.
  it('keeps two vaults of one share class in separate cache entries', async () => {
    const { queryClient, wrapper } = createWrapper();
    const otherVault = { ...SHARE_CLASS, vaultAddress: '0xbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc' } as const;

    const first = renderHook(() => useVaultCapacity({ shareClass: SHARE_CLASS }), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    getVault.mockImplementation(() =>
      Promise.resolve({ details: () => Promise.resolve({ maxDeposit: balance(9_000_000000n, 6) }) })
    );
    const second = renderHook(() => useVaultCapacity({ shareClass: otherVault }), { wrapper });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(first.result.current.data).toEqual({ maxDeposit: 5_000_000000n });
    expect(second.result.current.data).toEqual({ maxDeposit: 9_000_000000n });
    expect(queryClient.getQueryData(['CENTRIFUGE', 'zfix', otherVault.vaultAddress, 'VAULT_CAPACITY'])).toEqual({
      maxDeposit: 9_000_000000n
    });
  });
});

describe('useDepositPreview', () => {
  it('quotes shares from the handed vault previewDeposit and caches under the vault key', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useDepositPreview({ shareClass: SHARE_CLASS, assets: 100_000000n }), {
      wrapper
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ shares: 50_000000000000000000n });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: SHARE_CLASS.vaultAddress,
        functionName: 'previewDeposit',
        args: [100_000000n]
      })
    );
    expect(
      queryClient.getQueryData(['CENTRIFUGE', 'zfix', SHARE_CLASS.vaultAddress, 'DEPOSIT_PREVIEW', '100000000'])
    ).toEqual({
      shares: 50_000000000000000000n
    });
  });

  it('does not read for a non-positive amount', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDepositPreview({ shareClass: SHARE_CLASS, assets: 0n }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(readContract).not.toHaveBeenCalled();
  });

  it('surfaces a failed contract preview as a query error', async () => {
    readContract.mockRejectedValue(new Error('execution reverted'));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDepositPreview({ shareClass: SHARE_CLASS, assets: 100_000000n }), {
      wrapper
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRedemptionPosition', () => {
  it('returns the plain domain fields under the account and vault key', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ shareClass: SHARE_CLASS }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      pendingRedeemShares: 200_000000000000000000n,
      claimableRedeemAssets: 150_000000n,
      claimableRedeemSharesEquivalent: 140_000000000000000000n,
      claimableCancelRedeemShares: 60_000000000000000000n,
      hasPendingCancelRedeemRequest: false
    });
    expect(getVault).toHaveBeenCalledWith(SHARE_CLASS);
    expect(
      queryClient.getQueryData(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zfix', SHARE_CLASS.vaultAddress])
    ).toBeDefined();
  });

  it('does not read without a connected wallet', () => {
    useAccount.mockReturnValue({ isPending: false, isDisconnected: true, address: undefined });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ shareClass: SHARE_CLASS }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getVault).not.toHaveBeenCalled();
  });
});

describe('useInvestorWhitelist', () => {
  it('returns both vault verdicts under the account and vault key', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorWhitelist({ shareClass: SHARE_CLASS }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ canReceiveShares: true, canRequestRedemption: true });
    expect(getVault).toHaveBeenCalledWith(SHARE_CLASS);
    expect(
      queryClient.getQueryData(['ACCOUNT', INVESTOR, 'INVESTOR_WHITELIST', 'zfix', SHARE_CLASS.vaultAddress])
    ).toBeDefined();
  });

  it('reports a blocked wallet rather than throwing', async () => {
    getVault.mockImplementation(() =>
      Promise.resolve(fakeVault({ whitelist: { isAllowedToDeposit: false, isAllowedToRedeem: false } }))
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorWhitelist({ shareClass: SHARE_CLASS }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ canReceiveShares: false, canRequestRedemption: false });
  });

  it('keeps the two directions apart rather than collapsing them into one verdict', async () => {
    // The protocol answers these with different calls, and the redeem panel
    // gates different actions on each — a swap here would silently move which
    // buttons a wallet loses once it is no longer whitelisted.
    getVault.mockImplementation(() =>
      Promise.resolve(fakeVault({ whitelist: { isAllowedToDeposit: true, isAllowedToRedeem: false } }))
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorWhitelist({ shareClass: SHARE_CLASS }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ canReceiveShares: true, canRequestRedemption: false });
  });

  it('does not read without a connected wallet', () => {
    useAccount.mockReturnValue({ isPending: false, isDisconnected: true, address: undefined });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorWhitelist({ shareClass: SHARE_CLASS }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getVault).not.toHaveBeenCalled();
  });
});
