import { Separator } from '@zivoe/ui/core/separator';
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
      <DepositChartsComponent />
      <DiamondSeparator />

      <DepositStatsComponent />
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

  // Indexer failure hides the stats rather than rendering wrong numbers. A
  // successful fetch with a null APY is the young-pool case: fewer than 30
  // days of performance history exist.
  if (!metrics) return null;

  return <DepositStats nav={Number(metrics.navD18) / 1e18} apy={metrics.apy} />;
}

function DiamondSeparator() {
  return (
    <Separator>
      <DiamondIcon className="size-3 text-neutral-300" />
    </Separator>
  );
}
