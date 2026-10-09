'use client';

import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { type Address } from 'viem';

import { fetchDailyTokenSnapshots, fetchInvestorPositionCheckpoints } from '@zivoe/centrifuge-indexer';

import { queryKeys } from '@/lib/query-keys';

import { useTokenBalanceQueries } from '@/hooks/useBalance';
import { useCurrentShareMetrics } from '@/hooks/useCurrentShareMetrics';

import { type TransactionIdentity } from '@/centrifuge';
import { CENTRIFUGE_ENV } from '@/centrifuge/config';

import { type BalanceHistory, buildBalanceHistory } from './history';
import { portfolioTokens } from './positions';

const HISTORY_STALE_MS = 5 * 60 * 1000;
const PRICES_STALE_MS = 15 * 60 * 1000;

/**
 * The wallet's share-token value day by day, from the indexer's checkpoints
 * and daily closes, with a live point from the balances the portfolio
 * already reads (same cache entries, no extra RPC calls).
 */
export function usePortfolioHistory({
  identities,
  accountAddress
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  accountAddress: Address;
}): {
  history: BalanceHistory;
  status: 'pending' | 'error' | 'success';
  /** Whether today's point can be drawn: a share balance read or the price failed. */
  liveStatus: 'pending' | 'error' | 'success';
  /** A cursor walk or the price series hit its cap: the oldest days may be missing. */
  isTruncated: boolean;
  nowMs: number;
  refetch: () => void;
} {
  const shareTokens = useMemo(
    () => portfolioTokens(identities).filter((token) => token.kind === 'share'),
    [identities]
  );
  const shareClassKey = identities[0]!.centrifugeVault.shareClass.key;

  const checkpoints = useQuery({
    queryKey: queryKeys.account.portfolioHistory({ accountAddress, shareClassKey }),
    meta: { skipErrorToast: true },
    staleTime: HISTORY_STALE_MS,
    queryFn: ({ signal }) =>
      fetchInvestorPositionCheckpoints({
        environment: CENTRIFUGE_ENV.environment,
        shareClassKey,
        account: accountAddress,
        fetchOptions: { signal }
      })
  });
  const prices = useQuery({
    queryKey: queryKeys.app.dailyTokenSnapshots({ shareClassKey }),
    meta: { skipErrorToast: true },
    staleTime: PRICES_STALE_MS,
    queryFn: ({ signal }) =>
      fetchDailyTokenSnapshots({ environment: CENTRIFUGE_ENV.environment, shareClassKey, fetchOptions: { signal } })
  });
  const balances = useTokenBalanceQueries({
    tokens: shareTokens.map((token) => ({ chain: token.chain, tokenAddress: token.address })),
    accountAddress
  });
  const metrics = useCurrentShareMetrics({ shareClassKey });

  const nowMs = Date.now();
  const history = buildBalanceHistory({
    checkpoints: checkpoints.data?.checkpoints ?? [],
    chains: shareTokens,
    prices: prices.data?.snapshots ?? [],
    liveBalances: new Map(shareTokens.map((token, index) => [token.chainId, balances[index]?.data])),
    livePrice: metrics.data ? BigInt(metrics.data.sharePriceD18) : undefined,
    nowMs
  });

  return {
    history,
    status:
      checkpoints.isPending || prices.isPending
        ? 'pending'
        : checkpoints.isError || prices.isError
          ? 'error'
          : 'success',
    liveStatus: history.livePoint
      ? 'success'
      : balances.some((read) => read.isError) || (metrics.isError && !metrics.data)
        ? 'error'
        : 'pending',
    isTruncated: (checkpoints.data ? !checkpoints.data.complete : false) || (prices.data?.truncated ?? false),
    nowMs,
    refetch: () => {
      for (const read of [checkpoints, prices, metrics, ...balances]) void read.refetch();
    }
  };
}
