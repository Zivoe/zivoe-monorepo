import { type ComponentProps, Suspense } from 'react';

import { notFound } from 'next/navigation';

import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { Skeleton } from '@zivoe/ui/core/skeleton';

import { getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import { getQueryClient } from '@/lib/get-query-client';
import { queryKeys } from '@/lib/query-keys';

import Container from '@/components/container';
import Page from '@/components/page';

import { getOffering } from '@/offerings';

import { OnboardingGuard } from '../../_components/onboarding-guard';
import Deposit from './deposit';
import DepositInfo from './deposit-info';
import { depositPageViewSchema } from './deposit/_utils';
import OfferingHeader from './offering-header';

export default async function OfferingPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const [{ slug }, { view }] = await Promise.all([params, searchParams]);

  const offering = getOffering(slug);
  if (!offering) notFound();

  const validatedView = depositPageViewSchema.safeParse(view);

  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <Container>
          <OfferingHeader offering={offering} />
        </Container>

        {/* The header streams immediately; only this section waits on the
            indexer-backed prefetch. */}
        <Suspense
          fallback={
            <Page className="mt-10 flex gap-10 lg:mt-12 lg:flex-row">
              <Skeleton className="h-160 w-full rounded-xl" />
              <Skeleton className="hidden h-160 rounded-xl lg:block lg:min-w-120 xl:min-w-157.5" />
            </Page>
          }
        >
          <HydratedDepositSection initialView={validatedView.success ? validatedView.data : null} />
        </Suspense>
      </div>
    </>
  );
}

async function HydratedDepositSection({ initialView }: { initialView: ComponentProps<typeof Deposit>['initialView'] }) {
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
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Page className="mt-10 flex gap-10 lg:mt-12 lg:flex-row">
        <DepositInfo />
        <Deposit initialView={initialView} />
      </Page>
    </HydrationBoundary>
  );
}

// TODO: re-add this APY read once the deposit flow projects returns again.
// async function DepositWrapper({ initialView }: { initialView: DepositPageView }) {
//   const metrics = await getCurrentShareMetrics();
//
//   return <Deposit apy={metrics?.apy ?? null} initialView={initialView} />;
// }
