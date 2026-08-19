// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { type TransactionReceipt } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transactionAtom } from '@/lib/store';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { useRequestRedeem } from './index';

const getCentrifugeVault = vi.hoisted(() => vi.fn());
const setTransactionSigner = vi.hoisted(() => vi.fn());
const clearTransactionSigner = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getCentrifugeVault, setTransactionSigner, clearTransactionSigner }));

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

vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

const INVESTOR = '0xa28ef80d690844b586e192690d8fcdaecfd0281e' as const;
const TX_HASH = '0x4444444444444444444444444444444444444444444444444444444444444444';
// 200 shares in the fixture share class's 8-decimal base units.
const SHARES = 200_00000000n;
const ESTIMATED_ASSETS = 198_000000n;

function fakeCentrifugeVault({ redeemError }: { redeemError?: Error } = {}) {
  const receipt = { status: 'success', transactionHash: TX_HASH, logs: [] } as unknown as TransactionReceipt;

  return {
    asyncRedeem: () => ({
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
            // The SDK's own pre-checks reject through the transaction
            // observable before any signer interaction.
            if (redeemError) throw redeemError;

            const signer = setTransactionSigner.mock.calls[0]?.[0] as {
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
            };

            await signer.request({ method: 'eth_sendTransaction', params: [{ from: INVESTOR, data: '0x01' }] });
            observer.next({ type: 'TransactionPending', hash: TX_HASH });
            observer.next({ type: 'TransactionConfirmed', hash: TX_HASH, receipt });
            observer.complete();
          } catch (error) {
            observer.error(error);
          }
        })();

        return { unsubscribe: () => undefined };
      }
    })
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
  getCentrifugeVault.mockResolvedValue(fakeCentrifugeVault());
  getWalletClient.mockResolvedValue({ request: walletRequest });
  walletRequest.mockResolvedValue(TX_HASH);
  publicClientCall.mockResolvedValue({ data: '0x' });
});

describe('useRequestRedeem', () => {
  it('confirms a request with the Redemption Requested result and refreshes balance, portfolio, and the Redemption Position', async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useRequestRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ shares: SHARES, estimatedAssets: ESTIMATED_ASSETS }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getCentrifugeVault).toHaveBeenCalledWith(FIXTURE_IDENTITY.centrifugeVault);

    const dialog = getDefaultStore().get(transactionAtom);
    expect(dialog).toEqual({
      type: 'SUCCESS',
      title: 'Redemption Requested',
      description: 'Your final USDC amount is determined when your request is processed.',
      hash: TX_HASH,
      zivoeVaultSlug: 'fixture-zivoe-vault',
      chain: 'sepolia',
      meta: {
        redeem: {
          share: { symbol: 'zFIX', decimals: 8 },
          asset: { symbol: 'USDC', decimals: 6 },
          amount: SHARES,
          receive: ESTIMATED_ASSETS
        }
      }
    });
    expect(`${dialog?.title} ${dialog?.description}`).not.toContain('Redeemed');

    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['ACCOUNT', INVESTOR, 'BALANCE']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zfix'])
      ])
    );

    expect(analyticsCapture).toHaveBeenCalledWith(
      'tx:redeem_submitted',
      expect.objectContaining({
        zivoe_vault_slug: 'fixture-zivoe-vault',
        token_in: 'zFIX',
        token_out: 'USDC',
        amount_in_raw: SHARES.toString()
      })
    );
  });

  it("maps the SDK's own balance pre-check to product copy, before any wallet interaction", async () => {
    getCentrifugeVault.mockResolvedValue(fakeCentrifugeVault({ redeemError: new Error('Insufficient balance') }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRequestRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ shares: SHARES, estimatedAssets: ESTIMATED_ASSETS }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(walletRequest).not.toHaveBeenCalled();
    expect(uiToast).toHaveBeenCalledWith({
      type: 'error',
      title: "You don't have enough shares for this redemption request."
    });
  });
});
