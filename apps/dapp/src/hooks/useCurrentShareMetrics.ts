import { useQuery } from '@tanstack/react-query';

import { fetchCurrentShareMetrics, getCentrifugeIndexerConfig } from '@zivoe/centrifuge-indexer';

import { queryKeys } from '@/lib/query-keys';

import { env } from '@/env';

export const useCurrentShareMetrics = () => {
  return useQuery({
    queryKey: queryKeys.app.shareMetrics,
    meta: { toastErrorMessage: 'Error fetching Share Price' },
    refetchInterval: 5 * 60 * 1000,
    queryFn: () => fetchCurrentShareMetrics({ config: getCentrifugeIndexerConfig(env.NEXT_PUBLIC_NETWORK) })
  });
};
