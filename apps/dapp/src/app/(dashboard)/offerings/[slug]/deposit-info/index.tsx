import { Suspense } from 'react';

import { Separator } from '@zivoe/ui/core/separator';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { DiamondIcon } from '@zivoe/ui/icons';

import { getCentrifugeDailySnapshots, getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import DepositAbout from './deposit-about';
import DepositCharts from './deposit-charts';
import DepositContact from './deposit-contact';
import DepositDetails from './deposit-details';
import Documents from './deposit-documents';
import DepositHighlights from './deposit-highlights';
import DepositStats from './deposit-stats';

export default function DepositInfo() {
  return (
    <div className="flex w-full flex-col gap-8 lg:gap-10">
      {/* The static sections below stream without waiting on the indexer. */}
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <DepositChartsComponent />
      </Suspense>
      <DiamondSeparator />

      <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
        <DepositStatsComponent />
      </Suspense>
      <DiamondSeparator />

      <DepositAbout />
      <DiamondSeparator />

      <DepositHighlights />
      <DiamondSeparator />

      <DepositDetails />
      <DiamondSeparator />

      <Documents />
      <DiamondSeparator />

      <DepositContact />
    </div>
  );
}

async function DepositChartsComponent() {
  // Both reads dedupe within the request (React cache), so the stats section
  // and the chart overlay render the same current payload.
  const [snapshots, current] = await Promise.all([getCentrifugeDailySnapshots(), getCurrentShareMetrics()]);
  if (!snapshots || snapshots.length === 0) return null;

  return <DepositCharts snapshots={snapshots} current={current ?? null} />;
}

async function DepositStatsComponent() {
  const metrics = await getCurrentShareMetrics();

  // Indexer failure hides the stats rather than rendering wrong numbers.
  if (!metrics) return null;

  return <DepositStats nav={Number(metrics.navD18) / 1e18} sharePrice={Number(metrics.sharePriceD18) / 1e18} />;
}

function DiamondSeparator() {
  return (
    <Separator>
      <DiamondIcon className="size-3 text-neutral-300" />
    </Separator>
  );
}
