// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { type TransactionReceipt, encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transactionAtom } from '@/lib/store';

import { FIXTURE_IDENTITY } from '@/test/fixtures';
import { ZSMB_ZIVOE_VAULT, resolveTransactionIdentity } from '@/zivoe-vaults';

import { type TransactionIdentity, useDeposit } from './index';

const getCentrifugeVault = vi.hoisted(() => vi.fn());
const setTransactionSigner = vi.hoisted(() => vi.fn(() => () => undefined));
vi.mock('./client', () => ({ getCentrifugeVault, setTransactionSigner }));

const useAccount = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAccount', () => ({ useAccount }));

const analyticsCapture = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: analyticsCapture }) }));

vi.mock('wagmi', () => ({ useConfig: () => ({}), usePublicClient: () => ({ call: vi.fn() }) }));
vi.mock('wagmi/actions', () => ({ getWalletClient: vi.fn(() => Promise.resolve({})) }));

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(() => 'toast-id'), Toaster: () => null }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

// Pulled in by the Zivoe Vault modules' logos; raw UI TSX does not transform here.
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

const INVESTOR = '0xa28ef80d690844b586e192690d8fcdaecfd0281e' as const;
const TX_HASH = '0x3333333333333333333333333333333333333333333333333333333333333333';

const DEPOSIT_EVENT_ABI = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)'
]);

/** The zSMB identity as the app resolves it, next to the synthetic fixture class. */
const ZSMB_IDENTITY = resolveTransactionIdentity(ZSMB_ZIVOE_VAULT, 'sepolia');

const ZSMB_AMOUNTS = { assets: 1_000_000000n, shares: 934_579439252336448598n };
const FIXTURE_AMOUNTS = { assets: 250_000000n, shares: 233_64485981n };

function depositLog({
  centrifugeVaultAddress,
  assets,
  shares
}: {
  centrifugeVaultAddress: string;
  assets: bigint;
  shares: bigint;
}) {
  return {
    address: centrifugeVaultAddress.toLowerCase(),
    topics: encodeEventTopics({
      abi: DEPOSIT_EVENT_ABI,
      eventName: 'Deposit',
      args: { sender: INVESTOR, owner: INVESTOR }
    }),
    data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [assets, shares])
  };
}

/**
 * One receipt carrying Deposit events from BOTH Centrifuge vaults — decoding under each
 * identity must pick out only the transacted Centrifuge vault's amounts.
 */
function mixedReceipt(): TransactionReceipt {
  return {
    status: 'success',
    transactionHash: TX_HASH,
    logs: [
      depositLog({ centrifugeVaultAddress: ZSMB_IDENTITY.shareClass.centrifugeVaultAddress, ...ZSMB_AMOUNTS }),
      depositLog({ centrifugeVaultAddress: FIXTURE_IDENTITY.shareClass.centrifugeVaultAddress, ...FIXTURE_AMOUNTS })
    ]
  } as unknown as TransactionReceipt;
}

function fakeCentrifugeVault(receipt: TransactionReceipt) {
  return {
    syncDeposit: () => ({
      then: () => {
        throw new Error('SDK Transaction awaited directly — return it wrapped as { tx }');
      },
      subscribe: (observer: {
        next: (status: { type: string; hash?: string; receipt?: TransactionReceipt }) => void;
        complete: () => void;
      }) => {
        observer.next({ type: 'TransactionPending', hash: TX_HASH });
        observer.next({ type: 'TransactionConfirmed', hash: TX_HASH, receipt });
        observer.complete();
        return { unsubscribe: () => undefined };
      }
    })
  };
}

async function runDeposit({ identity, queryClient }: { identity: TransactionIdentity; queryClient: QueryClient }) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  const { result } = renderHook(() => useDeposit({ identity }), { wrapper });

  await act(async () => {
    result.current.mutate({ assets: 1n, previewShares: 1n });
  });
  await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

  return getDefaultStore().get(transactionAtom);
}

beforeEach(() => {
  vi.clearAllMocks();
  getDefaultStore().set(transactionAtom, undefined);
  useAccount.mockReturnValue({ isPending: false, isDisconnected: false, address: INVESTOR });
  getCentrifugeVault.mockImplementation(() => Promise.resolve(fakeCentrifugeVault(mixedReceipt())));
});

describe('two share classes side by side', () => {
  it('resolves each identity to its own Centrifuge vault and keeps caches per share class', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await runDeposit({ identity: ZSMB_IDENTITY, queryClient });
    await runDeposit({ identity: FIXTURE_IDENTITY, queryClient });

    expect(getCentrifugeVault).toHaveBeenNthCalledWith(1, ZSMB_IDENTITY.shareClass);
    expect(getCentrifugeVault).toHaveBeenNthCalledWith(2, FIXTURE_IDENTITY.shareClass);

    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['CENTRIFUGE', 'zsmb', 'VAULT_CAPACITY', 'sepolia']),
        JSON.stringify(['CENTRIFUGE', 'zfix', 'VAULT_CAPACITY', 'sepolia']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zsmb']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zfix']),
        JSON.stringify(['CENTRIFUGE', 'zsmb', 'SHARE_METRICS']),
        JSON.stringify(['CENTRIFUGE', 'zfix', 'SHARE_METRICS'])
      ])
    );
  });

  it('decodes a receipt only against the transacted Centrifuge vault and snapshots that identity', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // One receipt object shared by both runs: the decode memo must key by
    // Centrifuge vault as well as receipt for each class to read its own amounts.
    const receipt = mixedReceipt();
    getCentrifugeVault.mockImplementation(() => Promise.resolve(fakeCentrifugeVault(receipt)));

    const zsmbPayload = await runDeposit({ identity: ZSMB_IDENTITY, queryClient });
    expect(zsmbPayload?.zivoeVaultSlug).toBe('zivoe-smb-credit');
    expect(zsmbPayload?.description).toBe('zSMB has been transferred to your wallet.');
    expect(zsmbPayload?.meta?.deposit).toEqual({
      asset: { symbol: 'USDC', decimals: 6 },
      share: { symbol: 'zSMB', decimals: 18 },
      amount: ZSMB_AMOUNTS.assets,
      receive: ZSMB_AMOUNTS.shares
    });

    getDefaultStore().set(transactionAtom, undefined);

    const fixturePayload = await runDeposit({ identity: FIXTURE_IDENTITY, queryClient });
    expect(fixturePayload?.zivoeVaultSlug).toBe('fixture-zivoe-vault');
    expect(fixturePayload?.description).toBe('zFIX has been transferred to your wallet.');
    expect(fixturePayload?.meta?.deposit).toEqual({
      asset: { symbol: 'USDC', decimals: 6 },
      share: { symbol: 'zFIX', decimals: 8 },
      amount: FIXTURE_AMOUNTS.assets,
      receive: FIXTURE_AMOUNTS.shares
    });
  });

  it('stamps each transaction with its own Zivoe Vault slug on analytics', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await runDeposit({ identity: ZSMB_IDENTITY, queryClient });
    await runDeposit({ identity: FIXTURE_IDENTITY, queryClient });

    const slugs = analyticsCapture.mock.calls.map(
      ([, properties]) => (properties as { zivoe_vault_slug?: string }).zivoe_vault_slug
    );
    expect(slugs).toContain('zivoe-smb-credit');
    expect(slugs).toContain('fixture-zivoe-vault');
  });

  it('keeps the mutation-time identity when the hook re-renders under another Zivoe Vault mid-flight', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    // A Centrifuge vault whose transaction confirms only on command, so the hook can be
    // re-rendered with another Zivoe Vault while the receipt is pending.
    let confirm: (() => void) | undefined;
    const receipt = mixedReceipt();
    getCentrifugeVault.mockImplementation(() =>
      Promise.resolve({
        syncDeposit: () => ({
          then: () => {
            throw new Error('SDK Transaction awaited directly — return it wrapped as { tx }');
          },
          subscribe: (observer: {
            next: (status: { type: string; hash?: string; receipt?: TransactionReceipt }) => void;
            complete: () => void;
          }) => {
            observer.next({ type: 'TransactionPending', hash: TX_HASH });
            confirm = () => {
              observer.next({ type: 'TransactionConfirmed', hash: TX_HASH, receipt });
              observer.complete();
            };
            return { unsubscribe: () => undefined };
          }
        })
      })
    );

    const { result, rerender } = renderHook(
      ({ identity }: { identity: TransactionIdentity }) => useDeposit({ identity }),
      {
        wrapper,
        initialProps: { identity: ZSMB_IDENTITY }
      }
    );

    await act(async () => {
      result.current.mutate({ assets: 1n, previewShares: 1n });
    });
    await waitFor(() => expect(confirm).toBeDefined());

    // TanStack re-syncs the in-flight mutation's options to this render — the
    // payload must still carry the identity handed at mutation time.
    rerender({ identity: FIXTURE_IDENTITY });

    if (!confirm) throw new Error('The transaction never reached its confirm step');
    const confirmTransaction = confirm;
    await act(async () => {
      confirmTransaction();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const payload = getDefaultStore().get(transactionAtom);
    expect(payload?.zivoeVaultSlug).toBe('zivoe-smb-credit');
    expect(payload?.description).toBe('zSMB has been transferred to your wallet.');
    expect(payload?.meta?.deposit).toEqual({
      asset: { symbol: 'USDC', decimals: 6 },
      share: { symbol: 'zSMB', decimals: 18 },
      amount: ZSMB_AMOUNTS.assets,
      receive: ZSMB_AMOUNTS.shares
    });

    // The invalidations are pinned the same way: they refetch the
    // mutation-time class's scope, never the re-rendered one's.
    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys.some((key) => key.includes(ZSMB_IDENTITY.shareClass.key))).toBe(true);
    expect(invalidatedKeys.some((key) => key.includes(FIXTURE_IDENTITY.shareClass.key))).toBe(false);
  });
});
