'use client';

import { useCallback, useMemo } from 'react';

import { type InfiniteData, type QueryKey, useInfiniteQuery, useQueries, useQuery } from '@tanstack/react-query';
import { type Address } from 'viem';
import { useConfig } from 'wagmi';
import { getPublicClient } from 'wagmi/actions';

import { fetchInvestorActivityPage, fetchManualShareIssuances, getChainId } from '@zivoe/centrifuge-indexer';

import { queryKeys } from '@/lib/query-keys';

import { type TransactionIdentity } from '@/centrifuge';
import { CENTRIFUGE_ENV } from '@/centrifuge/config';

import { type ActivityEntry, buildActivity, cancelReturnCandidates, isCancelReturnReceipt } from './activity';

const ACTIVITY_STALE_MS = 60 * 1000;

type ActivityPage = Awaited<ReturnType<typeof fetchInvestorActivityPage>>;
const PAGE_SIZE = 20;

/**
 * The wallet's activity feed, newest first, a page at a time. Built from
 * the indexer's rows and the manager's issuance records; the few received
 * transfers that could be a cancellation's returned shares are settled by
 * reading their receipt once.
 */
export function usePortfolioActivity({
  identities,
  accountAddress
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  accountAddress: Address;
}): {
  entries: Array<ActivityEntry>;
  status: 'pending' | 'error' | 'success';
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  refetch: () => void;
} {
  const shareClassKey = identities[0]!.centrifugeVault.shareClass.key;
  const config = useConfig();
  const args = { environment: CENTRIFUGE_ENV.environment, shareClassKey, account: accountAddress };

  const issuances = useQuery({
    queryKey: queryKeys.account.portfolioIssuances({ accountAddress, shareClassKey }),
    meta: { skipErrorToast: true },
    staleTime: ACTIVITY_STALE_MS,
    queryFn: ({ signal }) => fetchManualShareIssuances({ ...args, fetchOptions: { signal } })
  });
  // Explicit generics: the page type does not infer through the spread arguments.
  const pages = useInfiniteQuery<ActivityPage, Error, InfiniteData<ActivityPage>, QueryKey, string | null>({
    queryKey: queryKeys.account.portfolioActivity({ accountAddress, shareClassKey }),
    meta: { skipErrorToast: true },
    staleTime: ACTIVITY_STALE_MS,
    initialPageParam: null,
    getNextPageParam: (page) => page.nextCursor,
    queryFn: ({ pageParam, signal }) =>
      fetchInvestorActivityPage({ ...args, after: pageParam, limit: PAGE_SIZE, fetchOptions: { signal } })
  });

  const rows = useMemo(() => pages.data?.pages.flatMap((page) => page.rows) ?? [], [pages.data]);
  const issued = useMemo(() => issuances.data ?? [], [issuances.data]);
  const candidates = useMemo(
    () =>
      cancelReturnCandidates(
        buildActivity({ rows, issuances: issued, cancelReturns: new Map(), identities: identities })
      ),
    [rows, issued, identities]
  );
  const receipts = useQueries({
    queries: candidates.map(({ chain, txHash }) => ({
      queryKey: queryKeys.app.cancelReturnReceipt({ chain, txHash }),
      meta: { skipErrorToast: true },
      staleTime: Infinity,
      queryFn: () => {
        const client = getPublicClient(config, { chainId: getChainId(chain) });
        if (!client) throw new Error(`No RPC client for ${chain}`);
        return isCancelReturnReceipt({ client, txHash, chain, identities: identities });
      }
    }))
  });
  // A receipt that cannot be read leaves the transfer as a plain receipt
  // rather than an entry that never resolves.
  const cancelReturns = new Map<string, boolean>();
  candidates.forEach(({ txHash }, index) => {
    const read = receipts[index];
    if (read?.data !== undefined) cancelReturns.set(txHash, read.data);
    else if (read?.isError) cancelReturns.set(txHash, false);
  });
  const entries = buildActivity({ rows, issuances: issued, cancelReturns, identities: identities });

  // Stable, so an effect that re-arms on it (the dialog's scroll sentinel) does not re-arm on every render.
  const { fetchNextPage: fetchNext } = pages;
  const fetchNextPage = useCallback(() => void fetchNext(), [fetchNext]);

  return {
    entries,
    status:
      pages.isPending || issuances.isPending ? 'pending' : pages.isError || issuances.isError ? 'error' : 'success',
    hasNextPage: pages.hasNextPage,
    isFetchingNextPage: pages.isFetchingNextPage,
    fetchNextPage,
    refetch: () => {
      void pages.refetch();
      void issuances.refetch();
    }
  };
}
