import { useQuery } from '@tanstack/react-query';

import {
  type ShareClassKey,
  type ShareStatsPayload,
  fetchCurrentShareMetrics,
  toShareStatsPayload
} from '@zivoe/centrifuge-indexer';

import { queryKeys } from '@/lib/query-keys';

import { env } from '@/env';

/**
 * Browser refetches run the same document and projection the server caches,
 * so hydrated and refetched data are shape-identical. Anomaly reporting stays
 * server-side; the browser just renders the nulled value.
 */
async function fetchShareStatsPayload(shareClassKey: ShareClassKey): Promise<ShareStatsPayload> {
  const { payload } = toShareStatsPayload(
    await fetchCurrentShareMetrics({ network: env.NEXT_PUBLIC_NETWORK, shareClassKey })
  );
  return payload;
}

/**
 * The share class's stats payload: server-prefetched into the hydrated cache
 * (no duplicate fetch on mount) and kept fresh with a browser poll straight
 * to the indexer.
 */
export const useCurrentShareMetrics = ({ shareClassKey }: { shareClassKey: ShareClassKey }) => {
  return useQuery({
    queryKey: queryKeys.app.shareMetrics({ shareClassKey }),
    meta: { toastErrorMessage: 'Error fetching Token Price' },
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => fetchShareStatsPayload(shareClassKey)
  });
};
