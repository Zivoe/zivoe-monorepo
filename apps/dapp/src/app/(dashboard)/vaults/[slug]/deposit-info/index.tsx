import { type ShareClassKey } from '@zivoe/centrifuge-indexer';
import { Separator } from '@zivoe/ui/core/separator';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { DiamondIcon, InfoIcon } from '@zivoe/ui/icons';

import { getCentrifugeDailySnapshots, getCurrentShareMetrics } from '@/server/data/centrifuge-metrics';

import InfoSection from '@/components/info-section';
import TextSkeleton from '@/components/text-skeleton';

import { type ZivoeVault } from '@/zivoe-vaults';

import DepositAbout from './deposit-about';
import DepositCharts from './deposit-charts';
import DepositContact from './deposit-contact';
import DepositDetails, { DepositDetailsSkeleton } from './deposit-details';
import Documents, { DocumentsSkeleton } from './deposit-documents';
import DepositHighlights from './deposit-highlights';
import DepositStats, { DepositStatsSkeleton } from './deposit-stats';

export default function DepositInfo({ zivoeVault }: { zivoeVault: ZivoeVault }) {
  return (
    <div className="flex w-full flex-col gap-8 lg:gap-10">
      <DepositChartsComponent shareClassKey={zivoeVault.shareClass.key} />
      <DiamondSeparator />

      {/* The figures and the highlight cards read as one untitled block. */}
      <div className="flex flex-col gap-8">
        <DepositStatsComponent
          shareClassKey={zivoeVault.shareClass.key}
          targetApyPercent={zivoeVault.targetApyPercent}
        />
        <DepositHighlights />
      </div>
      <DiamondSeparator />

      <DepositAbout paragraphs={zivoeVault.about} />
      <DiamondSeparator />

      <DepositDetails zivoeVault={zivoeVault} />
      <DiamondSeparator />

      <Documents documents={zivoeVault.documents} />
      <DiamondSeparator />

      <DepositContact />
    </div>
  );
}

/**
 * `DepositInfo` while the page's data is on its way. The loading state knows
 * no Zivoe Vault, so what is the same for every one renders for real (the
 * highlights, the section titles, the detail labels, the contact line) and
 * only the vault's own figures and copy pulse.
 */
export function DepositInfoSkeleton() {
  return (
    <div className="flex w-full flex-col gap-8 lg:gap-10">
      {/* DepositCharts: headline, view select, chart. */}
      <div className="flex w-full flex-col gap-4">
        <div className="flex justify-between gap-2">
          <p className="text-h4">
            <TextSkeleton className="w-28" />
          </p>
          <Skeleton className="h-9 w-36 rounded-full" />
        </div>

        <Skeleton className="aspect-video w-full rounded-sm" />
      </div>
      <DiamondSeparator />

      <div className="flex flex-col gap-8">
        <DepositStatsSkeleton />
        <DepositHighlights />
      </div>
      <DiamondSeparator />

      {/* DepositAbout: two clamped lines and Show More. */}
      <InfoSection title="About" icon={<InfoIcon />}>
        <div className="flex flex-col gap-2">
          <p className="text-leading">
            <TextSkeleton className="w-full" />
            <TextSkeleton className="w-4/5" />
          </p>
          <p className="text-regular">
            <TextSkeleton className="w-20" />
          </p>
        </div>
      </InfoSection>
      <DiamondSeparator />

      <DepositDetailsSkeleton />
      <DiamondSeparator />

      <DocumentsSkeleton />
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
