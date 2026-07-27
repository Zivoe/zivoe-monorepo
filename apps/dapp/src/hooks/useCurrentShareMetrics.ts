import { useQuery } from '@tanstack/react-query';

import {
  type ShareStatsPayload,
  fetchCurrentShareMetrics,
  getCentrifugeIndexerConfig,
  toShareStatsPayload
} from '@zivoe/centrifuge-indexer';

import { queryKeys } from '@/lib/query-keys';

import { env } from '@/env';

/**
 * Browser refetches run the same document and projection the server caches,
 * so hydrated and refetched data are shape-identical. Anomaly reporting stays
 * server-side; the browser just renders the nulled value.
 */
async function fetchShareStatsPayload(): Promise<ShareStatsPayload> {
  const config = getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK);
  const { payload } = toShareStatsPayload(await fetchCurrentShareMetrics({ config }));
  return payload;
}

/**
 * The shared stats payload: server-prefetched into the hydrated cache (no
 * duplicate fetch on mount) and kept fresh with a browser poll straight to
 * the indexer.
 */
export const useCurrentShareMetrics = () => {
  return useQuery({
    queryKey: queryKeys.app.shareMetrics,
    meta: { toastErrorMessage: 'Error fetching Share Price' },
    refetchInterval: 5 * 60 * 1000,
    queryFn: fetchShareStatsPayload
  });
};
