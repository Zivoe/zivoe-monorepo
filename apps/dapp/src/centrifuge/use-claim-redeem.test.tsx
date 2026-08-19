// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { ABI } from '@centrifuge/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { type TransactionReceipt, encodeAbiParameters, encodeEventTopics, encodeFunctionData, parseAbi } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transactionAtom } from '@/lib/store';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { useClaimRedeem } from './index';

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

const sentryCapture = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureException: sentryCapture }));

const INVESTOR = '0xa28ef80d690844b586e192690d8fcdaecfd0281e' as const;
const TX_HASH = '0x5555555555555555555555555555555555555555555555555555555555555555';

// Two partial fulfillments (60 + 90 USDC) aggregated into the position.
const CLAIMABLE_ASSETS = 150_000000n;
const CLAIMABLE_SHARES = 140_190000000000000000n;

const CLAIM_REDEEM_DATA = encodeFunctionData({
  abi: ABI.VaultRouter,
  functionName: 'claimRedeem',
  args: [FIXTURE_IDENTITY.shareClass.centrifugeVaultAddress, INVESTOR, INVESTOR]
});
const CLAIM_RETURNED_SHARES_DATA = encodeFunctionData({
  abi: ABI.VaultRouter,
  functionName: 'claimCancelRedeemRequest',
  args: [FIXTURE_IDENTITY.shareClass.centrifugeVaultAddress, INVESTOR, INVESTOR]
});

const WITHDRAW_EVENT_ABI = parseAbi([
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)'
]);

function claimReceipt({ withWithdrawLog = true }: { withWithdrawLog?: boolean } = {}) {
  const logs = withWithdrawLog
    ? [
        {
          address: FIXTURE_IDENTITY.shareClass.centrifugeVaultAddress.toLowerCase(),
          topics: encodeEventTopics({
            abi: WITHDRAW_EVENT_ABI,
            eventName: 'Withdraw',
            args: { sender: INVESTOR, receiver: INVESTOR, owner: INVESTOR }
          }),
          data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [CLAIMABLE_ASSETS, CLAIMABLE_SHARES])
        }
      ]
    : [];

  return { status: 'success', transactionHash: TX_HASH, logs } as unknown as TransactionReceipt;
}

const claimSpy = vi.fn();

const balance = (value: bigint) => ({ toBigInt: () => value });

function fakeCentrifugeVault({
  receipt = claimReceipt(),
  claimError,
  claimableCancelRedeemShares = 0n,
  claimData = CLAIM_REDEEM_DATA
}: {
  receipt?: TransactionReceipt;
  claimError?: Error;
  claimableCancelRedeemShares?: bigint;
  claimData?: `0x${string}`;
} = {}) {
  return {
    // The bucket guard reads a fresh investment before building the claim.
    investment: () =>
      Promise.resolve({
        pendingRedeemShares: balance(0n),
        claimableRedeemAssets: balance(150_000000n),
        claimableRedeemSharesEquivalent: balance(0n),
        claimableCancelRedeemShares: balance(claimableCancelRedeemShares),
        hasPendingCancelRedeemRequest: false
      }),
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

              await signer.request({
                method: 'eth_sendTransaction',
                params: [
                  {
                    from: INVESTOR,
                    to: FIXTURE_IDENTITY.shareClass.vaultRouterAddress,
                    data: claimData
                  }
                ]
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
  getCentrifugeVault.mockResolvedValue(fakeCentrifugeVault());
  getWalletClient.mockResolvedValue({ request: walletRequest });
  walletRequest.mockResolvedValue(TX_HASH);
  publicClientCall.mockResolvedValue({ data: '0x' });
});

describe('useClaimRedeem', () => {
  it('collects all claimable USDC across partial fulfillments in one aggregate claim transaction', async () => {
    const { wrapper, invalidateSpy } = createWrapper();
    const { result } = renderHook(() => useClaimRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ claimableAssets: CLAIMABLE_ASSETS }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // One transaction against the parameterized share class's Centrifuge vault, default
    // receiver/controller (the investor).
    expect(getCentrifugeVault).toHaveBeenCalledWith(FIXTURE_IDENTITY.shareClass);
    expect(claimSpy).toHaveBeenCalledOnce();
    expect(claimSpy).toHaveBeenCalledWith();
    expect(walletRequest).toHaveBeenCalledOnce();

    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'SUCCESS',
      title: 'USDC Claimed',
      description: 'USDC has been transferred to your wallet.',
      hash: TX_HASH,
      zivoeVaultSlug: 'fixture-zivoe-vault',
      chain: 'sepolia',
      meta: {
        claimRedeem: {
          share: { symbol: 'zFIX', decimals: 8 },
          asset: { symbol: 'USDC', decimals: 6 },
          assets: CLAIMABLE_ASSETS,
          shares: CLAIMABLE_SHARES
        }
      }
    });

    expect(analyticsCapture).toHaveBeenCalledWith(
      'tx:redeem_claim_receipt',
      expect.objectContaining({ zivoe_vault_slug: 'fixture-zivoe-vault', token_in: 'zFIX', token_out: 'USDC' })
    );

    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['ACCOUNT', INVESTOR, 'BALANCE']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zfix']),
        JSON.stringify(['CENTRIFUGE', 'zfix', 'SHARE_METRICS'])
      ])
    );
  });

  it("maps the SDK's no-claimable-funds error to product copy, before any wallet interaction", async () => {
    getCentrifugeVault.mockResolvedValue(fakeCentrifugeVault({ claimError: new Error('No claimable funds') }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ claimableAssets: 0n }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(walletRequest).not.toHaveBeenCalled();
    expect(uiToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'There are no redemption proceeds available to claim yet.'
    });
  });

  it('blocks the claim while Returned Shares are claimable, before any wallet interaction', async () => {
    getCentrifugeVault.mockResolvedValue(fakeCentrifugeVault({ claimableCancelRedeemShares: 60_000000000000000000n }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ claimableAssets: CLAIMABLE_ASSETS }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    // The aggregate claim would empty the Returned Shares bucket first — the
    // guard must stop it before any claim build or wallet prompt.
    expect(claimSpy).not.toHaveBeenCalled();
    expect(walletRequest).not.toHaveBeenCalled();
    expect(uiToast).toHaveBeenCalledWith({ type: 'error', title: 'Claim your returned zFIX first.' });
  });

  it('rejects an SDK bucket switch before the wallet can claim Returned Shares as USDC', async () => {
    getCentrifugeVault.mockResolvedValue(fakeCentrifugeVault({ claimData: CLAIM_RETURNED_SHARES_DATA }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ claimableAssets: CLAIMABLE_ASSETS }));
    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(claimSpy).toHaveBeenCalledOnce();
    expect(publicClientCall).not.toHaveBeenCalled();
    expect(walletRequest).not.toHaveBeenCalled();
    expect(uiToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Claimable balances changed. Claim your returned zFIX first.'
    });
  });

  it('does not report a successful USDC claim when the receipt cannot be decoded', async () => {
    getCentrifugeVault.mockResolvedValue(fakeCentrifugeVault({ receipt: claimReceipt({ withWithdrawLog: false }) }));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClaimRedeem({ identity: FIXTURE_IDENTITY }), { wrapper });

    act(() => result.current.mutate({ claimableAssets: CLAIMABLE_ASSETS }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getDefaultStore().get(transactionAtom)).toEqual({
      type: 'ERROR',
      title: 'Claim Could Not Be Verified',
      description: 'The transaction was confirmed, but the USDC claim could not be verified. Refresh your balances.',
      hash: TX_HASH,
      zivoeVaultSlug: 'fixture-zivoe-vault',
      chain: 'sepolia'
    });
    expect(sentryCapture).toHaveBeenCalled();
  });
});
