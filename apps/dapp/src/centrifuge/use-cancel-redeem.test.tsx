// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { type TransactionReceipt } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transactionAtom } from '@/lib/store';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { useCancelRedeem } from './index';

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
const TX_HASH = '0x6666666666666666666666666666666666666666666666666666666666666666';

const PENDING_SHARES = 5n * 10n ** 18n;

// The CancelRedeemRequest event carries no amount, so no logs are decoded —
// the dialog shows the pending snapshot from the mutation variables.
function cancelReceipt() {
  return { status: 'success', transactionHash: TX_HASH, logs: [] } as unknown as TransactionReceipt;
}

const cancelSpy = vi.fn();

function fakeVault({ cancelError }: { cancelError?: Error } = {}) {
  return {
    cancelRedeemRequest: (...args: Array<unknown>) => {
      cancelSpy(...args);

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
              // The SDK's own pending-order check rejects through the
              // transaction observable before any signer interaction.
              if (cancelError) throw cancelError;

              const signer = setTransactionSigner.mock.calls[0]?.[0] as {
                request: (args: { method: string; params?: unknown }) => Promise<unknown>;
              };

              await signer.request({ method: 'eth_sendTransaction', params: [{ from: INVESTOR, data: '0x03' }] });
              observer.next({ type: 'TransactionPending', hash: TX_HASH });
              observer.next({ type: 'TransactionConfirmed', hash: TX_HASH, receipt: cancelReceipt() });
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

describe('useCancelRedeem', () => {
  it('cancels the full pending amount and shows the snapshot in the success dialog', async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useCancelRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ pendingShares: PENDING_SHARES }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // One transaction, no arguments — the Cancellation always covers the full
    // remaining pending amount — against the vault of the identity parameter.
    expect(getVault).toHaveBeenCalledWith(FIXTURE_IDENTITY.shareClass);
    expect(cancelSpy).toHaveBeenCalledOnce();
    expect(cancelSpy).toHaveBeenCalledWith();
    expect(walletRequest).toHaveBeenCalledOnce();

    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'SUCCESS',
      title: 'Cancellation Requested',
      description:
        'Your zFIX will be available to claim once the cancellation is processed. Any portion already approved by the pool manager still executes and arrives as USDC.',
      hash: TX_HASH,
      offeringSlug: 'fixture-offering',
      meta: { cancelRedeem: { share: { symbol: 'zFIX', decimals: 8 }, shares: PENDING_SHARES } }
    });

    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['ACCOUNT', INVESTOR, 'BALANCE']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zfix'])
      ])
    );

    expect(analyticsCapture).toHaveBeenCalledWith(
      'tx:redeem_cancel_submitted',
      expect.objectContaining({ offering_slug: 'fixture-offering', token_in: 'zFIX' })
    );
  });

  it("maps the SDK's no-order error to product copy, before any wallet interaction", async () => {
    getVault.mockResolvedValue(fakeVault({ cancelError: new Error('No order to cancel') }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCancelRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ pendingShares: PENDING_SHARES }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(walletRequest).not.toHaveBeenCalled();
    expect(uiToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'There is no redemption request to cancel.'
    });
  });

  it('rejects a zero pending snapshot before reaching the SDK', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCancelRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ pendingShares: 0n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(cancelSpy).not.toHaveBeenCalled();
    expect(uiToast).toHaveBeenCalledWith({ type: 'error', title: 'No redemption request to cancel' });
  });
});
