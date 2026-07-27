// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { type TransactionReceipt, encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transactionAtom } from '@/lib/store';

import { CENTRIFUGE_CONFIG, useClaimReturnedShares } from './index';

const getVault = vi.hoisted(() => vi.fn());
const setTransactionSigner = vi.hoisted(() => vi.fn());
const clearTransactionSigner = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getVault, setTransactionSigner, clearTransactionSigner }));

const useAccount = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAccount', () => ({ useAccount }));

const analyticsCapture = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: analyticsCapture }) }));

const publicClientCall = vi.hoisted(() => vi.fn());
vi.mock('wagmi', () => ({
  useConfig: () => ({}),
  usePublicClient: () => ({ call: publicClientCall }),
  useWriteContract: () => ({ mutateAsync: vi.fn() })
}));

const getWalletClient = vi.hoisted(() => vi.fn());
vi.mock('wagmi/actions', () => ({ getWalletClient }));

const uiToast = vi.hoisted(() => vi.fn(() => 'toast-id'));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: uiToast, Toaster: () => null }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) }));

const sentryCapture = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureException: sentryCapture }));

const INVESTOR = '0xa28ef80d690844b586e192690d8fcdaecfd0281e' as const;
const TX_HASH = '0x7777777777777777777777777777777777777777777777777777777777777777';

const RETURNED_SHARES = 4n * 10n ** 18n;

const CANCEL_REDEEM_CLAIM_EVENT_ABI = parseAbi([
  'event CancelRedeemClaim(address indexed controller, address indexed receiver, uint256 indexed requestId, address sender, uint256 shares)'
]);

function claimReceipt({ withClaimLog = true }: { withClaimLog?: boolean } = {}) {
  const logs = withClaimLog
    ? [
        {
          address: CENTRIFUGE_CONFIG.vaultAddress.toLowerCase(),
          topics: encodeEventTopics({
            abi: CANCEL_REDEEM_CLAIM_EVENT_ABI,
            eventName: 'CancelRedeemClaim',
            args: { controller: INVESTOR, receiver: INVESTOR, requestId: 0n }
          }),
          data: encodeAbiParameters([{ type: 'address' }, { type: 'uint256' }], [INVESTOR, RETURNED_SHARES])
        }
      ]
    : [];

  return { status: 'success', transactionHash: TX_HASH, logs } as unknown as TransactionReceipt;
}

const claimSpy = vi.fn();

function fakeVault({
  receipt = claimReceipt(),
  claimError
}: { receipt?: TransactionReceipt; claimError?: Error } = {}) {
  return {
    claim: (...args: Array<unknown>) => {
      claimSpy(...args);

      return {
        // The real SDK Transaction is also a PromiseLike; awaiting it bare runs
        // it to completion unobserved. Fail loudly if any code path does that.
        then: () => {
          throw new Error('SDK Transaction awaited directly — return it wrapped as { tx }');
        },
        subscribe: (observer: {
          next: (status: { type: string; hash?: string; receipt?: TransactionReceipt }) => void;
          error: (error: unknown) => void;
          complete: () => void;
        }) => {
          void (async () => {
            try {
              // The SDK's own claimability check rejects through the
              // transaction observable before any signer interaction.
              if (claimError) throw claimError;

              const signer = setTransactionSigner.mock.calls[0]?.[0] as {
                request: (args: { method: string; params?: unknown }) => Promise<unknown>;
              };

              await signer.request({ method: 'eth_sendTransaction', params: [{ from: INVESTOR, data: '0x04' }] });
              observer.next({ type: 'TransactionPending', hash: TX_HASH });
              observer.next({ type: 'TransactionConfirmed', hash: TX_HASH, receipt });
              observer.complete();
            } catch (error) {
              observer.error(error);
            }
          })();

          return { unsubscribe: () => undefined };
        }
      };
    }
  };
}

const walletRequest = vi.fn();

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidateSpy };
}

beforeEach(() => {
  vi.clearAllMocks();
  getDefaultStore().set(transactionAtom, undefined);

  useAccount.mockReturnValue({ isPending: false, isDisconnected: false, address: INVESTOR });
  getVault.mockResolvedValue(fakeVault());
  getWalletClient.mockResolvedValue({ request: walletRequest });
  walletRequest.mockResolvedValue(TX_HASH);
  publicClientCall.mockResolvedValue({ data: '0x' });
});

describe('useClaimReturnedShares', () => {
  it('claims Returned Shares through the aggregate claim and decodes the exact zMCA', async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useClaimReturnedShares(), { wrapper });

    act(() => result.current.mutate({ returnedShares: RETURNED_SHARES }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // One transaction, default receiver/controller (the investor).
    expect(claimSpy).toHaveBeenCalledOnce();
    expect(claimSpy).toHaveBeenCalledWith();
    expect(walletRequest).toHaveBeenCalledOnce();

    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'SUCCESS',
      title: 'zMCA claimed',
      description: 'Your zMCA has been returned to your wallet.',
      hash: TX_HASH,
      meta: { claimReturnedShares: { shares: RETURNED_SHARES } }
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['ACCOUNT', INVESTOR, 'BALANCE']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'INVESTMENT'])
      ])
    );
  });

  it("maps the SDK's no-claimable-funds error to product copy, before any wallet interaction", async () => {
    getVault.mockResolvedValue(fakeVault({ claimError: new Error('No claimable funds') }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimReturnedShares(), { wrapper });

    act(() => result.current.mutate({ returnedShares: 0n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(walletRequest).not.toHaveBeenCalled();
    expect(uiToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'There is no returned zMCA available to claim yet.'
    });
  });

  it('degrades to a generic zMCA claimed result when the receipt cannot be decoded', async () => {
    getVault.mockResolvedValue(fakeVault({ receipt: claimReceipt({ withClaimLog: false }) }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimReturnedShares(), { wrapper });

    act(() => result.current.mutate({ returnedShares: RETURNED_SHARES }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'SUCCESS',
      title: 'zMCA claimed',
      description: 'Your zMCA has been returned to your wallet.',
      hash: TX_HASH,
      meta: undefined
    });
    expect(sentryCapture).toHaveBeenCalled();
  });
});
