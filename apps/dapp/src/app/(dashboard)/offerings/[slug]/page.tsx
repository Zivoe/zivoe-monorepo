import { type Metadata } from 'next';
import { notFound } from 'next/navigation';

import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

import { getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import { getQueryClient } from '@/lib/get-query-client';
import { queryKeys } from '@/lib/query-keys';

import Container from '@/components/container';
import Page from '@/components/page';

import { getOffering, resolveTransactionIdentity } from '@/offerings';

import { OnboardingGuard } from '../../_components/onboarding-guard';
import Deposit from './deposit';
import DepositInfo from './deposit-info';
import { depositPageViewSchema } from './deposit/_utils';
import OfferingHeader from './offering-header';
import { OfferingIdentityProvider } from './offering-provider';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const offering = getOffering(slug);

  // Unknown slugs fall through to the root metadata; the page itself 404s.
  if (!offering) return {};

  const title = `${offering.name} | Zivoe`;

  // Title only — the description falls through to the root layout's platform
  // copy, which every vault shares until per-vault blurbs are authored again.
  return { title, openGraph: { title }, twitter: { title } };
}

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

  // Resolved once here; client trees read only this serializable object.
  const identity = resolveTransactionIdentity(offering);

  const validatedView = depositPageViewSchema.safeParse(view);

  // Seed the browser cache with the server's cached payload, so client
  // consumers mount on hydrated data instead of re-fetching the document the
  // RSCs just rendered. React cache dedupes this with the RSC reads below.
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.app.shareMetrics({ shareClassKey: offering.shareClass.key }),
    queryFn: async () => {
      const payload = await getCurrentShareMetrics(offering.shareClass.key);
      // Throwing keeps a failed prefetch out of the dehydrated state, so the
      // browser fetches fresh on mount instead of hydrating an empty success.
      if (!payload) throw new Error('Centrifuge current share metrics are unavailable');
      return payload;
    }
  });

  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <Container>
          <OfferingHeader offering={offering} />
        </Container>

        <HydrationBoundary state={dehydrate(queryClient)}>
          {/* Keyed by slug so no component state can leak across Offerings. */}
          <Page key={offering.slug} className="mt-10 flex gap-10 lg:mt-12 lg:flex-row">
            <OfferingIdentityProvider identity={identity} status={offering.status}>
              <DepositInfo offering={offering} />
              <Deposit initialView={validatedView.success ? validatedView.data : null} />
            </OfferingIdentityProvider>
          </Page>
        </HydrationBoundary>
      </div>
    </>
  );
}

// TODO: re-add this APY read once the deposit flow projects returns again.
// async function DepositWrapper({ initialView }: { initialView: DepositPageView }) {
//   const metrics = await getCurrentShareMetrics();
//
//   return <Deposit apy={metrics?.apy ?? null} initialView={initialView} />;
// }
