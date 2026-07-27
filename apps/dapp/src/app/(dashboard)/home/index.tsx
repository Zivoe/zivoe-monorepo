import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import Hero from '@/components/hero';
import Page from '@/components/page';

import { getQueryClient } from '@/lib/get-query-client';
import { queryKeys } from '@/lib/query-keys';

import Deposit from './deposit';
import DepositInfo from './deposit-info';
import { type DepositPageView } from './deposit/_utils';

export default async function Home({ initialView }: { initialView: DepositPageView }) {
  // Seed the browser cache with the server's cached payload, so client
  // consumers mount on hydrated data instead of re-fetching the document the
  // RSCs just rendered. React cache dedupes this with the RSC reads below.
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.app.shareMetrics,
    queryFn: async () => {
      const payload = await getCurrentShareMetrics();
      // Throwing keeps a failed prefetch out of the dehydrated state, so the
      // browser fetches fresh on mount instead of hydrating an empty success.
      if (!payload) throw new Error('Centrifuge current share metrics are unavailable');
      return payload;
    }
  });

  return (
    <div className="bg-surface-base">
      <Hero title="zMCA" description="Gain exposure to private credit" />

      <HydrationBoundary state={dehydrate(queryClient)}>
        <Page className="flex gap-10 lg:flex-row">
          <DepositInfo />
          <DepositWrapper initialView={initialView} />
        </Page>
      </HydrationBoundary>
    </div>
  );
}

async function DepositWrapper({ initialView }: { initialView: DepositPageView }) {
  // 30-day Trailing APY from the shared current-share-metrics path; null until
  // 30 days of history exist (or on indexer failure — the card shows a dash).
  const metrics = await getCurrentShareMetrics();

  return <Deposit apy={metrics?.apy ?? null} initialView={initialView} />;
}
