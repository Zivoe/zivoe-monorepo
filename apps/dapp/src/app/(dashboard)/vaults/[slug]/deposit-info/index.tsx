import { type ShareClassKey } from '@zivoe/centrifuge-indexer';
import { Separator } from '@zivoe/ui/core/separator';
import { DiamondIcon } from '@zivoe/ui/icons';

import { getCentrifugeDailySnapshots, getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import { type ZivoeVault } from '@/zivoe-vaults';

import DepositAbout from './deposit-about';
import DepositCharts from './deposit-charts';
import DepositContact from './deposit-contact';
import DepositDetails from './deposit-details';
import Documents from './deposit-documents';
import DepositHighlights from './deposit-highlights';
import DepositStats from './deposit-stats';

export default function DepositInfo({ zivoeVault }: { zivoeVault: ZivoeVault }) {
  return (
    <div className="flex w-full flex-col gap-8 lg:gap-10">
      <DepositChartsComponent shareClassKey={zivoeVault.shareClass.key} />
      <DiamondSeparator />

      <DepositStatsComponent shareClassKey={zivoeVault.shareClass.key} targetApyPercent={zivoeVault.targetApyPercent} />
      <DiamondSeparator />

      <DepositAbout paragraphs={zivoeVault.about} />
      <DiamondSeparator />

      <DepositHighlights />
      <DiamondSeparator />

      <DepositDetails zivoeVault={zivoeVault} />
      <DiamondSeparator />

      <Documents documents={zivoeVault.documents} />
      <DiamondSeparator />

      <DepositContact />
    </div>
  );
}

async function DepositChartsComponent({ shareClassKey }: { shareClassKey: ShareClassKey }) {
  // Both reads dedupe within the request (React cache), so the stats section
  // and the chart overlay render the same current payload.
  const [snapshots, current] = await Promise.all([
    getCentrifugeDailySnapshots(shareClassKey),
    getCurrentShareMetrics(shareClassKey)
  ]);
  if (!snapshots || snapshots.length === 0) return null;

  return <DepositCharts snapshots={snapshots} current={current ?? null} />;
}

async function DepositStatsComponent({
  shareClassKey,
  targetApyPercent
}: {
  shareClassKey: ShareClassKey;
  targetApyPercent: number;
}) {
  const metrics = await getCurrentShareMetrics(shareClassKey);

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
