// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import {
  RawContractError,
  type TransactionReceipt,
  createWalletClient,
  custom,
  encodeAbiParameters,
  encodeErrorResult,
  encodeEventTopics,
  parseAbi
} from 'viem';
import { sepolia } from 'viem/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transactionAtom } from '@/lib/store';
import { AppError } from '@/lib/utils';

import { CENTRIFUGE_CONFIG, useDeposit } from './index';

const getVault = vi.hoisted(() => vi.fn());
const releaseTransactionSigner = vi.hoisted(() => vi.fn());
const setTransactionSigner = vi.hoisted(() => vi.fn((_signer: unknown) => releaseTransactionSigner));
vi.mock('./client', () => ({ getVault, setTransactionSigner }));

const useAccount = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAccount', () => ({ useAccount }));

const analyticsCapture = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: analyticsCapture }) }));

const publicClientCall = vi.hoisted(() => vi.fn());
const publicClientGetReceipt = vi.hoisted(() => vi.fn());
vi.mock('wagmi', () => ({
  useConfig: () => ({}),
  usePublicClient: () => ({ call: publicClientCall, getTransactionReceipt: publicClientGetReceipt }),
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
const TX_HASH = '0x3333333333333333333333333333333333333333333333333333333333333333';
const APPROVE_HASH = '0x4444444444444444444444444444444444444444444444444444444444444444';
const ASSETS = 1_000_000000n;
const DECODED_SHARES = 934_579439252336448598n;

const DEPOSIT_EVENT_ABI = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)'
]);

function depositReceipt({ withDepositLog = true }: { withDepositLog?: boolean } = {}) {
  const logs = withDepositLog
    ? [
        {
          address: CENTRIFUGE_CONFIG.vaultAddress.toLowerCase(),
          topics: encodeEventTopics({
            abi: DEPOSIT_EVENT_ABI,
            eventName: 'Deposit',
            args: { sender: INVESTOR, owner: INVESTOR }
          }),
          data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [ASSETS, DECODED_SHARES])
        }
      ]
    : [];

  return { status: 'success', transactionHash: TX_HASH, logs } as unknown as TransactionReceipt;
}

/**
 * Fakes the SDK's transaction observable the way the real SDK behaves: it asks
 * the installed signer to send, then emits pending and confirmed statuses.
 */
function fakeVault({ receipt }: { receipt: TransactionReceipt }) {
  return {
    syncDeposit: () => ({
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
            const signer = setTransactionSigner.mock.calls[0]?.[0] as {
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
            };

            observer.next({ type: 'SigningTransaction' });
            await signer.request({
              method: 'eth_sendTransaction',
              params: [{ from: INVESTOR, to: CENTRIFUGE_CONFIG.vaultRouterAddress, data: '0xdeadbeef', value: '0x0' }]
            });
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

/**
 * Emits pending, then errors the stream the way the SDK's doTransaction does on
 * a reverted receipt. With `errorCarriesReceipt: false` the error arrives
 * receipt-less, like when the dev log forwarder displaces the SDK's throw.
 */
function fakeVaultRevertingOnChain({
  receipt,
  errorCarriesReceipt = true
}: {
  receipt: TransactionReceipt;
  errorCarriesReceipt?: boolean;
}) {
  return {
    syncDeposit: () => ({
      then: () => {
        throw new Error('SDK Transaction awaited directly — return it wrapped as { tx }');
      },
      subscribe: (observer: {
        next: (status: { type: string; hash?: string }) => void;
        error: (error: unknown) => void;
      }) => {
        observer.next({ type: 'TransactionPending', hash: receipt.transactionHash });
        observer.error(
          errorCarriesReceipt
            ? Object.assign(new Error('Transaction reverted'), { receipt })
            : new TypeError('Do not know how to serialize a BigInt')
        );
        return { unsubscribe: () => undefined };
      }
    })
  };
}

/**
 * Two-transaction action, the way the SDK's syncDeposit behaves when the
 * on-chain allowance is short: an approve transaction signs and confirms
 * first, then the invest step fails before reaching TransactionPending.
 */
function fakeVaultApproveThenFailingInvest() {
  return {
    syncDeposit: () => ({
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
            const signer = setTransactionSigner.mock.calls[0]?.[0] as {
              request: (args: { method: string; params?: unknown }) => Promise<unknown>;
            };

            observer.next({ type: 'SigningTransaction' });
            await signer.request({ method: 'eth_sendTransaction', params: [{ from: INVESTOR }] });
            observer.next({ type: 'TransactionPending', hash: APPROVE_HASH });
            observer.next({
              type: 'TransactionConfirmed',
              hash: APPROVE_HASH,
              receipt: { status: 'success', transactionHash: APPROVE_HASH, logs: [] } as unknown as TransactionReceipt
            });

            observer.next({ type: 'SigningTransaction' });
            await signer.request({ method: 'eth_sendTransaction', params: [{ from: INVESTOR }] });
          } catch (error) {
            observer.error(error);
          }
        })();

        return { unsubscribe: () => undefined };
      }
    })
  };
}

/** Errors the stream with a plain SDK error, as thrown before signing. */
function fakeVaultFailingWith(error: Error) {
  return {
    syncDeposit: () => ({
      then: () => {
        throw new Error('SDK Transaction awaited directly — return it wrapped as { tx }');
      },
      subscribe: (observer: { error: (error: unknown) => void }) => {
        observer.error(error);
        return { unsubscribe: () => undefined };
      }
    })
  };
}

/**
 * Sends through a real viem walletClient over the installed signer — the same
 * custom(signer) transport the SDK uses, so signer rejections arrive with
 * viem's production error wrapping.
 */
function fakeVaultThroughViemWallet() {
  return {
    syncDeposit: () => ({
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
            const signer = setTransactionSigner.mock.calls[0]?.[0] as Parameters<typeof custom>[0];
            const walletClient = createWalletClient({ account: INVESTOR, chain: sepolia, transport: custom(signer) });

            observer.next({ type: 'SigningTransaction' });
            const hash = await walletClient.sendTransaction({
              to: CENTRIFUGE_CONFIG.vaultRouterAddress,
              data: '0xdeadbeef',
              value: 0n
            });
            observer.next({ type: 'TransactionPending', hash });
            observer.next({ type: 'TransactionConfirmed', hash, receipt: depositReceipt() });
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
  getVault.mockResolvedValue(fakeVault({ receipt: depositReceipt() }));
  getWalletClient.mockResolvedValue({ request: walletRequest });
  walletRequest.mockResolvedValue(TX_HASH);
  publicClientCall.mockResolvedValue({ data: '0x' });
});

describe('useDeposit', () => {
  it('drives a deposit through simulate -> send -> receipt with the success dialog and exact decoded amounts', async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Simulation ran the exact call before the wallet saw the send request.
    expect(publicClientCall).toHaveBeenCalledOnce();
    expect(walletRequest).toHaveBeenCalledOnce();
    const callOrder = publicClientCall.mock.invocationCallOrder[0] ?? 0;
    const sendOrder = walletRequest.mock.invocationCallOrder[0] ?? 0;
    expect(callOrder).toBeLessThan(sendOrder);
    expect(publicClientCall).toHaveBeenCalledWith(
      expect.objectContaining({ account: INVESTOR, to: CENTRIFUGE_CONFIG.vaultRouterAddress, data: '0xdeadbeef' })
    );

    // Success dialog carries the exact decoded USDC-in / zMCA-out.
    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'SUCCESS',
      title: 'Deposit Successful',
      description: 'zMCA has been transferred to your wallet.',
      hash: TX_HASH,
      meta: { deposit: { token: 'USDC', amount: ASSETS, receive: DECODED_SHARES } }
    });

    expect(setTransactionSigner).toHaveBeenCalledOnce();
    expect(releaseTransactionSigner).toHaveBeenCalledOnce();

    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        JSON.stringify([
          'ACCOUNT',
          INVESTOR,
          'ALLOWANCE',
          CENTRIFUGE_CONFIG.usdc.address,
          CENTRIFUGE_CONFIG.vaultRouterAddress
        ]),
        JSON.stringify(['ACCOUNT', INVESTOR, 'BALANCE']),
        JSON.stringify(['CENTRIFUGE', 'VAULT_CAPACITY']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'INVESTMENT'])
      ])
    );

    const events = analyticsCapture.mock.calls.map(([event]) => event);
    expect(events).toEqual(['tx:deposit_submitted', 'tx:deposit_receipt']);
    expect(analyticsCapture).toHaveBeenCalledWith(
      'tx:deposit_receipt',
      expect.objectContaining({
        amount_in_raw: ASSETS.toString(),
        amount_out_raw: DECODED_SHARES.toString(),
        token_in: 'USDC',
        token_out: 'zMCA',
        chain_id: CENTRIFUGE_CONFIG.chainId,
        receipt_status: 'success'
      })
    );
  });

  it('blocks a reverting transaction before the wallet prompt with a decoded friendly error', async () => {
    publicClientCall.mockRejectedValue(
      new RawContractError({
        data: encodeErrorResult({ abi: parseAbi(['error ExceedsMaxDeposit()']), errorName: 'ExceedsMaxDeposit' })
      })
    );

    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(walletRequest).not.toHaveBeenCalled();
    expect(getDefaultStore().get(transactionAtom)).toBeUndefined();
    expect(uiToast).toHaveBeenCalledWith({
      type: 'error',
      title: "This vault can't accept that deposit right now. Try a smaller amount or try again later."
    });

    // Settled non-rejection failures still run the invalidations.
    expect(invalidateSpy).toHaveBeenCalled();
    expect(analyticsCapture).toHaveBeenCalledWith('tx:deposit_failed', expect.objectContaining({ step: 'failed' }));
  });

  it('degrades to a generic success when the receipt cannot be decoded', async () => {
    getVault.mockResolvedValue(fakeVault({ receipt: depositReceipt({ withDepositLog: false }) }));

    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'SUCCESS',
      title: 'Deposit Successful',
      description: 'zMCA has been transferred to your wallet.',
      hash: TX_HASH,
      meta: undefined
    });
    expect(sentryCapture).toHaveBeenCalled();
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('treats a wallet rejection as a warning without refetches', async () => {
    walletRequest.mockRejectedValue(new Error('User rejected the request'));

    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(uiToast).toHaveBeenCalledWith({ type: 'warning', title: 'Transaction rejected' });
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(analyticsCapture).toHaveBeenCalledWith(
      'tx:deposit_signature_rejected',
      expect.objectContaining({ error_type: 'user_rejected' })
    );
  });

  it('fails the action when a later step of a multi-transaction deposit is rejected, instead of resolving with the approve receipt', async () => {
    getVault.mockResolvedValue(fakeVaultApproveThenFailingInvest());
    walletRequest.mockResolvedValueOnce(APPROVE_HASH).mockRejectedValueOnce(new Error('User rejected the request'));
    // If the chain fallback ran, it would find the confirmed approve receipt —
    // the test must fail loudly on a false success, not on a missing mock.
    publicClientGetReceipt.mockResolvedValue({
      status: 'success',
      transactionHash: APPROVE_HASH,
      logs: []
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    // The approve receipt never stands in for the failed invest step.
    expect(publicClientGetReceipt).not.toHaveBeenCalled();
    expect(getDefaultStore().get(transactionAtom)).toBeUndefined();
    expect(uiToast).toHaveBeenCalledWith({ type: 'warning', title: 'Transaction rejected' });

    const events = analyticsCapture.mock.calls.map(([event]) => event);
    expect(events).not.toContain('tx:deposit_receipt');
    expect(events).toContain('tx:deposit_signature_rejected');
  });

  it('resolves the signer lazily for every transaction', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    getVault.mockResolvedValue(fakeVault({ receipt: depositReceipt() }));
    setTransactionSigner.mockClear();

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getWalletClient).toHaveBeenCalledTimes(2);
  });

  it('releases the signer lock when the wallet never answers the signing request', async () => {
    vi.useFakeTimers();
    try {
      // A dead WalletConnect session: the send request neither resolves nor rejects.
      walletRequest.mockReturnValue(new Promise(() => undefined));

      const { wrapper, invalidateSpy } = createWrapper();
      const { result } = renderHook(() => useDeposit(), { wrapper });

      act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5 * 60_000);
      });

      expect(result.current.isError).toBe(true);
      expect(releaseTransactionSigner).toHaveBeenCalledOnce();
      expect(uiToast).toHaveBeenCalledWith({
        type: 'warning',
        title:
          'Your wallet did not respond. If you approved the transaction in your wallet, wait for it to land before trying again.'
      });
      // "Gave up waiting" is not "did not happen": a late approval can still
      // broadcast, so the invalidations must run and let balances self-correct.
      expect(invalidateSpy).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("cannot release another transaction's signer when the lock is already held", async () => {
    setTransactionSigner.mockImplementationOnce(() => {
      throw new AppError({ message: 'Another transaction is already in progress' });
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    // The contender never acquired the signer, so it has no release to run —
    // the in-flight transaction's signer and lock stay untouched.
    expect(releaseTransactionSigner).not.toHaveBeenCalled();
    expect(walletRequest).not.toHaveBeenCalled();
  });

  it('keeps the decoded copy when a real viem walletClient wraps the simulation error', async () => {
    // custom(signer) transport buries the simulation's AppError in a
    // TransactionExecutionError → UnknownRpcError cause chain.
    getVault.mockResolvedValue(fakeVaultThroughViemWallet());
    walletRequest.mockImplementation(({ method }: { method: string }) =>
      Promise.resolve(method === 'eth_chainId' ? '0xaa36a7' : TX_HASH)
    );
    publicClientCall.mockRejectedValue(
      new RawContractError({
        data: encodeErrorResult({ abi: parseAbi(['error ExceedsMaxDeposit()']), errorName: 'ExceedsMaxDeposit' })
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    // The wallet answered the chainId passthrough but never saw the send.
    expect(walletRequest).not.toHaveBeenCalledWith(expect.objectContaining({ method: 'eth_sendTransaction' }));
    expect(uiToast).toHaveBeenCalledWith({
      type: 'error',
      title: "This vault can't accept that deposit right now. Try a smaller amount or try again later."
    });
  });

  it('renders the failure dialog when the transaction reverts on-chain', async () => {
    const revertedReceipt = { status: 'reverted', transactionHash: TX_HASH, logs: [] } as unknown as TransactionReceipt;
    getVault.mockResolvedValue(fakeVaultRevertingOnChain({ receipt: revertedReceipt }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'ERROR',
      title: 'Deposit Failed',
      description: 'Your deposit could not be completed.',
      hash: TX_HASH
    });
    expect(uiToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(analyticsCapture).toHaveBeenCalledWith(
      'tx:deposit_failed',
      expect.objectContaining({ receipt_status: 'reverted', tx_hash: TX_HASH })
    );
    // The receipt came off the error itself — no chain re-fetch needed.
    expect(publicClientGetReceipt).not.toHaveBeenCalled();
  });

  it('recovers the reverted receipt from the chain when the SDK error loses it', async () => {
    const revertedReceipt = { status: 'reverted', transactionHash: TX_HASH, logs: [] } as unknown as TransactionReceipt;
    getVault.mockResolvedValue(fakeVaultRevertingOnChain({ receipt: revertedReceipt, errorCarriesReceipt: false }));
    publicClientGetReceipt.mockResolvedValue(revertedReceipt);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(publicClientGetReceipt).toHaveBeenCalledWith({ hash: TX_HASH });
    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'ERROR',
      title: 'Deposit Failed',
      description: 'Your deposit could not be completed.',
      hash: TX_HASH
    });
    expect(uiToast).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('maps wrong-network SDK errors to product copy', async () => {
    getVault.mockResolvedValue(
      fakeVaultFailingWith(
        new Error(
          'Wallet is connected to chainId=1 but transaction targets chainId=11155111. ' +
            'Refusing to submit to avoid sending funds on the wrong network.'
        )
      )
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDeposit(), { wrapper });

    act(() => result.current.mutate({ assets: ASSETS, previewShares: 900_000000000000000000n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(uiToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Your wallet is connected to the wrong network. Switch networks and try again.'
    });
  });
});
