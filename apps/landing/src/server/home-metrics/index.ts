import 'server-only';

import { fetchNetworkShareMetrics } from '@zivoe/centrifuge-indexer';

import { type HomeMetrics } from '@/lib/home-metrics';

import { env } from '@/env';

import { createMetricSource } from './cache';

const loadOnchain = createMetricSource(['nav', 'tokenPrice'], async () => {
  const data = await fetchNetworkShareMetrics({
    environment: env.NEXT_PUBLIC_CHAIN_ENV,
    shareClassKey: 'zsmb',
    fetchOptions: { cache: 'no-store' }
  });
  const observedAt = new Date().toISOString();
  return {
    nav: {
      value: data.navD36.toString(),
      sourceAt: data.navPriceComputedAt.toISOString(),
      indexedAt: data.indexedAt.toISOString(),
      observedAt
    },
    tokenPrice: { value: data.sharePriceD18.toString(), sourceAt: data.priceComputedAt.toISOString(), observedAt }
  };
});

export async function getHomeMetrics(): Promise<HomeMetrics> {
  return loadOnchain();
}
