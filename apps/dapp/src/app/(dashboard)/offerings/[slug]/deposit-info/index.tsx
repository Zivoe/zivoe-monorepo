import { Separator } from '@zivoe/ui/core/separator';
import { DiamondIcon } from '@zivoe/ui/icons';

import { getCentrifugeDailySnapshots, getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import { type Offering } from '@/offerings';

import DepositAbout from './deposit-about';
import DepositCharts from './deposit-charts';
import DepositContact from './deposit-contact';
import DepositDetails from './deposit-details';
import Documents from './deposit-documents';
import DepositHighlights from './deposit-highlights';
import DepositStats from './deposit-stats';

export default function DepositInfo({ offering }: { offering: Offering }) {
  return (
    <div className="flex w-full flex-col gap-8 lg:gap-10">
      <DepositChartsComponent />
      <DiamondSeparator />

      <DepositStatsComponent targetApyPercent={offering.targetApyPercent} />
      <DiamondSeparator />

      <DepositAbout paragraphs={offering.about} />
      <DiamondSeparator />

      <DepositHighlights />
      <DiamondSeparator />

      <DepositDetails details={offering.details} />
      <DiamondSeparator />

      <Documents documents={offering.documents} />
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

async function DepositStatsComponent({ targetApyPercent }: { targetApyPercent: number }) {
  const metrics = await getCurrentShareMetrics();

  // Indexer failure hides the stats rather than rendering wrong numbers.
  if (!metrics) return null;

  return (
    <DepositStats
      nav={Number(metrics.navD18) / 1e18}
      sharePrice={Number(metrics.sharePriceD18) / 1e18}
      targetApyPercent={targetApyPercent}
    />
  );
}

function DiamondSeparator() {
  return (
    <Separator>
      <DiamondIcon className="size-3 text-neutral-300" />
    </Separator>
  );
}
