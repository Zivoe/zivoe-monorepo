// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { useDepositPreview, useRedemptionPosition, useVaultCapacity } from './index';

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

function fakeVault() {
  return {
    details: () => Promise.resolve({ maxDeposit: balance(5_000_000000n, 6) }),
    investment: () =>
      Promise.resolve({
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
    expect(queryClient.getQueryData(['CENTRIFUGE', 'zfix', 'VAULT_CAPACITY'])).toEqual({
      maxDeposit: 5_000_000000n
    });
  });
});

describe('useDepositPreview', () => {
  it('quotes shares from the handed vault previewDeposit and caches under the share-class key', async () => {
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
    expect(queryClient.getQueryData(['CENTRIFUGE', 'zfix', 'DEPOSIT_PREVIEW', '100000000'])).toEqual({
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
  it('returns the plain domain fields under the account and share-class key', async () => {
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
    expect(queryClient.getQueryData(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zfix'])).toBeDefined();
  });

  it('does not read without a connected wallet', () => {
    useAccount.mockReturnValue({ isPending: false, isDisconnected: true, address: undefined });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ shareClass: SHARE_CLASS }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getVault).not.toHaveBeenCalled();
  });
});
