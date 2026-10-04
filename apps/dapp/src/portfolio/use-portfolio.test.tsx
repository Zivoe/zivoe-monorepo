// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type * as Indexer from '@zivoe/centrifuge-indexer';

import { queryKeys } from '@/lib/query-keys';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { usePortfolio, usePortfolioActivity } from './use-portfolio';

type PortfolioMocks = { account?: `0x${string}` } & Record<
  'read' | 'positions' | 'checkpoints' | 'prices' | 'activity' | 'metrics',
  ReturnType<typeof vi.fn>
>;
const mocks = vi.hoisted(
  (): PortfolioMocks => ({
    account: '0x1111111111111111111111111111111111111111',
    read: vi.fn(),
    positions: vi.fn(),
    checkpoints: vi.fn(),
    prices: vi.fn(),
    activity: vi.fn(),
    metrics: vi.fn()
  })
);
vi.mock('@/hooks/useAccount', () => ({ useAccount: () => ({ address: mocks.account }) }));
vi.mock('wagmi', () => ({ useConfig: () => ({}), usePublicClient: () => ({ readContract: mocks.read }) }));
vi.mock('wagmi/actions', () => ({ getPublicClient: () => ({ readContract: mocks.read }) }));
vi.mock('@/centrifuge/client', () => ({ getCentrifugeVault: async () => ({}) }));
vi.mock('@/centrifuge/reads', () => ({
  readRedemptionPosition: (...args: Array<unknown>) => mocks.positions(...args)
}));
vi.mock('@zivoe/centrifuge-indexer', async (original) => ({
  ...(await original<typeof Indexer>()),
  fetchWalletCheckpoints: (...args: Array<unknown>) => mocks.checkpoints(...args),
  fetchDailyTokenSnapshots: (...args: Array<unknown>) => mocks.prices(...args),
  fetchWalletActivityPage: (...args: Array<unknown>) => mocks.activity(...args),
  fetchCurrentShareMetrics: (...args: Array<unknown>) => mocks.metrics(...args)
}));

const empty = {
  pendingRedeemShares: 0n,
  claimableRedeemAssets: 0n,
  claimableRedeemSharesEquivalent: 0n,
  unfundedClaimableAssets: 0n,
  claimableCancelRedeemShares: 0n,
  hasPendingCancelRedeemRequest: false
};
const D18 = 10n ** 18n;
afterEach(() => vi.clearAllMocks());
function setup() {
  mocks.account = '0x1111111111111111111111111111111111111111';
  mocks.read.mockResolvedValue(10n ** 8n);
  mocks.positions.mockResolvedValue(empty);
  mocks.checkpoints.mockResolvedValue({ checkpoints: [], complete: true });
  mocks.prices.mockResolvedValue({ snapshots: [], truncated: false });
  mocks.activity.mockResolvedValue({ entries: [], nextCursor: null });
  mocks.metrics.mockResolvedValue({ sharePrice: D18, nav: D18, priceComputedAt: new Date(), yield30dComp365: null });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 } } });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
  };
}

describe('portfolio controller', () => {
  it('uses the preview address for every read, clears on preview switch, and can return to the connected wallet', async () => {
    const { wrapper, client } = setup();
    const connected = mocks.account;
    const preview = '0x2222222222222222222222222222222222222222' as const;
    const otherPreview = '0x3333333333333333333333333333333333333333' as const;
    const initialProps: { accountAddress: `0x${string}` | undefined } = { accountAddress: preview };
    const { result, rerender, unmount } = renderHook(
      ({ accountAddress }: typeof initialProps) => ({
        portfolio: usePortfolio([FIXTURE_IDENTITY], accountAddress),
        activity: usePortfolioActivity(false, accountAddress)
      }),
      { wrapper, initialProps }
    );
    await waitFor(() => {
      expect(result.current.portfolio.model.complete).toBe(true);
      expect(result.current.activity.isSuccess).toBe(true);
    });
    expect(mocks.read.mock.calls.every(([call]) => call.args[0] === preview)).toBe(true);
    expect(mocks.positions).toHaveBeenCalledWith(expect.objectContaining({ investor: preview }));
    expect(mocks.checkpoints).toHaveBeenCalledWith(expect.objectContaining({ account: preview }));
    expect(mocks.activity).toHaveBeenCalledWith(expect.objectContaining({ account: preview }));
    expect(client.getQueriesData({ queryKey: queryKeys.account.by({ accountAddress: connected }) })).toEqual([]);

    mocks.read.mockImplementation(() => new Promise(() => undefined));
    mocks.positions.mockImplementation(() => new Promise(() => undefined));
    mocks.checkpoints.mockImplementation(() => new Promise(() => undefined));
    mocks.activity.mockImplementation(() => new Promise(() => undefined));
    rerender({ accountAddress: otherPreview });
    expect(result.current.portfolio.model.totalD18).toBeNull();
    expect(result.current.portfolio.model.requests).toEqual([]);
    expect(result.current.portfolio.historyQuery.data).toBeUndefined();
    expect(result.current.activity.data).toBeUndefined();

    mocks.read.mockResolvedValue(10n ** 8n);
    mocks.positions.mockResolvedValue(empty);
    mocks.checkpoints.mockResolvedValue({ checkpoints: [], complete: true });
    mocks.activity.mockResolvedValue({ entries: [], nextCursor: null });
    rerender({ accountAddress: undefined });
    await waitFor(() => expect(result.current.portfolio.model.complete).toBe(true));
    expect(mocks.account).toBe(connected);
    expect(mocks.read).toHaveBeenLastCalledWith(expect.objectContaining({ args: [connected] }));
    expect(mocks.positions).toHaveBeenLastCalledWith(expect.objectContaining({ investor: connected }));
    expect(mocks.checkpoints).toHaveBeenLastCalledWith(expect.objectContaining({ account: connected }));
    expect(mocks.activity).toHaveBeenLastCalledWith(expect.objectContaining({ account: connected }));
    unmount();
    client.clear();
  });

  it('clears wallet data synchronously on wallet switch and disconnect; isolates history/activity caches', async () => {
    const { wrapper, client } = setup();
    const { result, rerender, unmount } = renderHook(
      () => ({ portfolio: usePortfolio([FIXTURE_IDENTITY]), activity: usePortfolioActivity(false) }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.portfolio.model.complete).toBe(true));
    expect(result.current.portfolio.model.totalD18).toBe(101n * D18);
    const first = mocks.account;
    mocks.read.mockImplementation(() => new Promise(() => undefined));
    mocks.positions.mockImplementation(() => new Promise(() => undefined));
    mocks.checkpoints.mockImplementation(() => new Promise(() => undefined));
    mocks.activity.mockImplementation(() => new Promise(() => undefined));
    mocks.account = '0x2222222222222222222222222222222222222222';
    rerender();
    expect(result.current.portfolio.model.totalD18).toBeNull();
    expect(result.current.portfolio.model.requests).toEqual([]);
    expect(result.current.portfolio.historyQuery.data).toBeUndefined();
    expect(result.current.activity.data).toBeUndefined();
    expect(client.getQueriesData({ queryKey: queryKeys.account.portfolio({ accountAddress: first }) })).toHaveLength(2);
    mocks.account = undefined;
    rerender();
    expect(result.current.portfolio.model.totalD18).toBeNull();
    expect(result.current.activity.data).toBeUndefined();
    unmount();
    client.clear();
  });
  it('reuses balance/position caches and retries all portfolio data on Refresh', async () => {
    const { wrapper, client } = setup();
    const { result, unmount } = renderHook(
      () => ({ portfolio: usePortfolio([FIXTURE_IDENTITY, FIXTURE_IDENTITY]), activity: usePortfolioActivity(false) }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.portfolio.model.complete).toBe(true));
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(mocks.positions).toHaveBeenCalledTimes(1);
    mocks.read.mockRejectedValue(new Error('offline'));
    act(() => result.current.portfolio.refresh());
    await waitFor(() => expect(result.current.portfolio.model.complete).toBe(false));
    expect(result.current.portfolio.model.holdings[0]?.chains[0]?.available).toBe(D18);
    expect(result.current.portfolio.model.totalD18).toBeNull();
    mocks.read.mockResolvedValue(0n);
    act(() => result.current.portfolio.refresh());
    await waitFor(() => expect(result.current.portfolio.model.totalD18).toBe(0n));
    expect(mocks.checkpoints.mock.calls.length).toBeGreaterThan(1);
    expect(mocks.activity.mock.calls.length).toBeGreaterThan(1);
    unmount();
    client.clear();
  });
});

describe('activity pagination and invalidation', () => {
  it('fetches later pages and resets the filter cursor for Transfers', async () => {
    const { wrapper, client } = setup();
    mocks.activity.mockImplementation(({ after, transfersOnly }: { after: string | null; transfersOnly: boolean }) =>
      Promise.resolve({ entries: [], nextCursor: after || transfersOnly ? null : 'page2' })
    );
    const { result, rerender, unmount } = renderHook(({ transfers }) => usePortfolioActivity(transfers), {
      wrapper,
      initialProps: { transfers: false }
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(mocks.activity).toHaveBeenLastCalledWith(expect.objectContaining({ after: 'page2', transfersOnly: false }));
    rerender({ transfers: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(mocks.activity).toHaveBeenLastCalledWith(expect.objectContaining({ after: null, transfersOnly: true }));
    unmount();
    client.clear();
  });
});
