// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { getDefaultStore } from 'jotai';
import { type TransactionReceipt, encodeAbiParameters, encodeEventTopics, parseAbi } from 'viem';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { transactionAtom } from '@/lib/store';

import { ZMCA_OFFERING } from '@/offerings';
import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { type TransactionIdentity, resolveTransactionIdentity, useDeposit } from './index';

const getVault = vi.hoisted(() => vi.fn());
const setTransactionSigner = vi.hoisted(() => vi.fn(() => () => undefined));
vi.mock('./client', () => ({ getVault, setTransactionSigner }));

const useAccount = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAccount', () => ({ useAccount }));

const analyticsCapture = vi.hoisted(() => vi.fn());
vi.mock('@/lib/analytics/use-analytics', () => ({ useAnalytics: () => ({ capture: analyticsCapture }) }));

vi.mock('wagmi', () => ({ useConfig: () => ({}), usePublicClient: () => ({ call: vi.fn() }) }));
vi.mock('wagmi/actions', () => ({ getWalletClient: vi.fn(() => Promise.resolve({})) }));

vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(() => 'toast-id'), Toaster: () => null }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { dismiss: vi.fn() }) }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));

// Pulled in by the zMCA Offering module's logo; raw UI TSX does not transform here.
vi.mock('@zivoe/ui/icons', () => ({ ZMcaLogo: () => null }));

const INVESTOR = '0xa28ef80d690844b586e192690d8fcdaecfd0281e' as const;
const TX_HASH = '0x3333333333333333333333333333333333333333333333333333333333333333';

const DEPOSIT_EVENT_ABI = parseAbi([
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)'
]);

/** The zMCA identity as the app resolves it, next to the synthetic fixture class. */
const ZMCA_IDENTITY = resolveTransactionIdentity(ZMCA_OFFERING);

const ZMCA_AMOUNTS = { assets: 1_000_000000n, shares: 934_579439252336448598n };
const FIXTURE_AMOUNTS = { assets: 250_000000n, shares: 233_64485981n };

function depositLog({ vaultAddress, assets, shares }: { vaultAddress: string; assets: bigint; shares: bigint }) {
  return {
    address: vaultAddress.toLowerCase(),
    topics: encodeEventTopics({
      abi: DEPOSIT_EVENT_ABI,
      eventName: 'Deposit',
      args: { sender: INVESTOR, owner: INVESTOR }
    }),
    data: encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [assets, shares])
  };
}

/**
 * One receipt carrying Deposit events from BOTH vaults — decoding under each
 * identity must pick out only the transacted vault's amounts.
 */
function mixedReceipt(): TransactionReceipt {
  return {
    status: 'success',
    transactionHash: TX_HASH,
    logs: [
      depositLog({ vaultAddress: ZMCA_IDENTITY.shareClass.vaultAddress, ...ZMCA_AMOUNTS }),
      depositLog({ vaultAddress: FIXTURE_IDENTITY.shareClass.vaultAddress, ...FIXTURE_AMOUNTS })
    ]
  } as unknown as TransactionReceipt;
}

function fakeVault(receipt: TransactionReceipt) {
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
  getVault.mockImplementation(() => Promise.resolve(fakeVault(mixedReceipt())));
});

describe('two share classes side by side', () => {
  it('resolves each identity to its own vault and keeps caches per share class', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    await runDeposit({ identity: ZMCA_IDENTITY, queryClient });
    await runDeposit({ identity: FIXTURE_IDENTITY, queryClient });

    expect(getVault).toHaveBeenNthCalledWith(1, ZMCA_IDENTITY.shareClass);
    expect(getVault).toHaveBeenNthCalledWith(2, FIXTURE_IDENTITY.shareClass);

    const invalidatedKeys = invalidateSpy.mock.calls.map(([filters]) => JSON.stringify(filters?.queryKey));
    expect(invalidatedKeys).toEqual(
      expect.arrayContaining([
        JSON.stringify(['CENTRIFUGE', 'zmca', 'VAULT_CAPACITY']),
        JSON.stringify(['CENTRIFUGE', 'zfix', 'VAULT_CAPACITY']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zmca']),
        JSON.stringify(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zfix']),
        JSON.stringify(['CENTRIFUGE', 'zmca', 'SHARE_METRICS']),
        JSON.stringify(['CENTRIFUGE', 'zfix', 'SHARE_METRICS'])
      ])
    );
  });

  it('decodes a receipt only against the transacted vault and snapshots that identity', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    // One receipt object shared by both runs: the decode memo must key by
    // vault as well as receipt for each class to read its own amounts.
    const receipt = mixedReceipt();
    getVault.mockImplementation(() => Promise.resolve(fakeVault(receipt)));

    const zmcaPayload = await runDeposit({ identity: ZMCA_IDENTITY, queryClient });
    expect(zmcaPayload?.offeringSlug).toBe('global-mca-offerings');
    expect(zmcaPayload?.description).toBe('zMCA has been transferred to your wallet.');
    expect(zmcaPayload?.meta?.deposit).toEqual({
      asset: { symbol: 'USDC', decimals: 6 },
      share: { symbol: 'zMCA', decimals: 18 },
      amount: ZMCA_AMOUNTS.assets,
      receive: ZMCA_AMOUNTS.shares
    });

    getDefaultStore().set(transactionAtom, undefined);

    const fixturePayload = await runDeposit({ identity: FIXTURE_IDENTITY, queryClient });
    expect(fixturePayload?.offeringSlug).toBe('fixture-offering');
    expect(fixturePayload?.description).toBe('zFIX has been transferred to your wallet.');
    expect(fixturePayload?.meta?.deposit).toEqual({
      asset: { symbol: 'USDC', decimals: 6 },
      share: { symbol: 'zFIX', decimals: 8 },
      amount: FIXTURE_AMOUNTS.assets,
      receive: FIXTURE_AMOUNTS.shares
    });
  });

  it('stamps each transaction with its own Offering slug on analytics', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await runDeposit({ identity: ZMCA_IDENTITY, queryClient });
    await runDeposit({ identity: FIXTURE_IDENTITY, queryClient });

    const slugs = analyticsCapture.mock.calls.map(
      ([, properties]) => (properties as { offering_slug?: string }).offering_slug
    );
    expect(slugs).toContain('global-mca-offerings');
    expect(slugs).toContain('fixture-offering');
  });
});
