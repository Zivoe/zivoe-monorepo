'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Address } from 'viem';

import { fetchDailyTokenSnapshots, fetchWalletActivityPage, fetchWalletCheckpoints } from '@zivoe/centrifuge-indexer';

import { queryKeys } from '@/lib/query-keys';

import { useAccount } from '@/hooks/useAccount';
import { useTokenBalanceQueries } from '@/hooks/useBalance';
import { useCurrentShareMetrics } from '@/hooks/useCurrentShareMetrics';

import { CENTRIFUGE_ENV } from '@/centrifuge/config';
import { useRedemptionPositions } from '@/centrifuge/hooks';
import { type TransactionIdentity } from '@/centrifuge/types';

import { buildWalletHistory } from './history';
import { buildPortfolio, portfolioTokens, positionKey, tokenKey, uniqueIdentities } from './model';

export function usePortfolio(suppliedIdentities: ReadonlyArray<TransactionIdentity>, accountAddress?: Address) {
  const { address: connectedAddress } = useAccount();
  const address = accountAddress ?? connectedAddress;
  const queryClient = useQueryClient();
  const identities = uniqueIdentities(suppliedIdentities);
  const tokens = portfolioTokens(identities);
  const balances = useTokenBalanceQueries(tokens, address);
  const positions = useRedemptionPositions({
    centrifugeVaults: identities.map((identity) => identity.centrifugeVault),
    accountAddress: address
  });
  const metrics = useCurrentShareMetrics({ shareClassKey: 'zsmb' });
  const price = metrics.data ? BigInt(metrics.data.sharePriceD18) : undefined;
  const historyQuery = useQuery({
    queryKey: [
      ...queryKeys.account.portfolio({ accountAddress: address }),
      'HISTORY',
      CENTRIFUGE_ENV.environment,
      'zsmb'
    ],
    enabled: Boolean(address),
    meta: { skipErrorToast: true },
    queryFn: async ({ signal }) => {
      const args = {
        environment: CENTRIFUGE_ENV.environment,
        shareClassKey: 'zsmb',
        account: address!,
        fetchOptions: { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) }
      };
      const [checkpoints, prices] = await Promise.all([
        fetchWalletCheckpoints(args),
        fetchDailyTokenSnapshots({ ...args, paginate: true })
      ]);
      return { ...checkpoints, ...prices };
    }
  });
  const model = buildPortfolio({
    identities,
    balances: new Map(tokens.map((token, index) => [tokenKey(token), balances[index]!])),
    positions: new Map(identities.map((identity, index) => [positionKey(identity), positions[index]!])),
    sharePrice: { data: price, isError: metrics.isError, isPending: metrics.isPending }
  });
  const nowMs =
    Math.max(historyQuery.dataUpdatedAt, ...balances.map((read) => read.dataUpdatedAt), metrics.dataUpdatedAt) ||
    Date.now();
  const history = buildWalletHistory({
    checkpoints: historyQuery.data?.checkpoints ?? [],
    snapshots: historyQuery.data?.snapshots ?? [],
    chains: tokens.flatMap((token, index) =>
      token.asset === 'zSMB'
        ? [
            {
              chainId: token.chainId,
              decimals: token.decimals,
              liveBalance: balances[index]?.isSuccess ? balances[index]?.data : undefined
            }
          ]
        : []
    ),
    checkpointsComplete: historyQuery.isSuccess && Boolean(historyQuery.data?.complete),
    pricesComplete: historyQuery.isSuccess && !historyQuery.data?.truncated,
    livePrice: metrics.isSuccess ? price : undefined,
    nowMs
  });
  const refresh = () => {
    void Promise.all([
      ...balances.map((read) => read.refetch()),
      ...positions.map((read) => read.refetch()),
      metrics.refetch(),
      queryClient.invalidateQueries({ queryKey: queryKeys.account.portfolio({ accountAddress: address }) })
    ]);
  };
  return {
    model,
    history,
    historyQuery,
    nowMs,
    refresh,
    isRefreshing:
      balances.some((read) => read.isFetching) ||
      positions.some((read) => read.isFetching) ||
      metrics.isFetching ||
      historyQuery.isFetching
  };
}

export function usePortfolioActivity(transfersOnly: boolean, accountAddress?: Address) {
  const { address: connectedAddress } = useAccount();
  const address = accountAddress ?? connectedAddress;
  return useInfiniteQuery({
    queryKey: [
      ...queryKeys.account.portfolio({ accountAddress: address }),
      'ACTIVITY',
      'TRANSACTION_CONTEXT_V2',
      CENTRIFUGE_ENV.environment,
      'zsmb',
      transfersOnly
    ],
    initialPageParam: null as string | null,
    enabled: Boolean(address),
    meta: { skipErrorToast: true },
    queryFn: ({ pageParam, signal }) =>
      fetchWalletActivityPage({
        environment: CENTRIFUGE_ENV.environment,
        shareClassKey: 'zsmb',
        account: address!,
        after: pageParam,
        transfersOnly,
        includeTransactionContext: true,
        fetchOptions: { signal: AbortSignal.any([signal, AbortSignal.timeout(30_000)]) }
      }),
    getNextPageParam: (page) => page.nextCursor
  });
}
