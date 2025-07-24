import { Suspense } from 'react';

import { Separator } from '@zivoe/ui/core/separator';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { ChartIcon, DiamondIcon, PieChartIcon } from '@zivoe/ui/icons';

import { data } from '@/server/data';

import { DepositInfoSection } from './common';
import DepositAbout from './deposit-about';
import DepositAllocation from './deposit-allocation';
import DepositCharts from './deposit-charts';
import DepositContact from './deposit-contact';
import DepositDetails from './deposit-details';
import Documents from './deposit-documents';
import DepositHighlights from './deposit-highlights';
import DepositStats from './deposit-stats';

export default async function DepositInfo() {
  return (
    <div className="flex w-full flex-col gap-8 lg:gap-10">
      <Suspense fallback={<DepositChartsSkeleton />}>
        <DepositChartsComponent />
      </Suspense>

      <Suspense fallback={<DepositStatsSkeleton />}>
        <DepositStatsComponent />
      </Suspense>

      <DepositAbout />
      <DiamondSeparator />

      <DepositHighlights />
      <DiamondSeparator />

      <DepositDetails />
      <DiamondSeparator />

      <Suspense fallback={<DepositAllocationSkeleton />}>
        <DepositAllocationComponent />
      </Suspense>

      <Documents />
      <DiamondSeparator />

      <DepositContact />
    </div>
  );
}

async function DepositChartsComponent() {
  const dailyData = await data.getDepositDailyData();
  if (!dailyData) return null;

  return (
    <>
      <DepositCharts dailyData={dailyData} />
      <DiamondSeparator />
    </>
  );
}

function DepositChartsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-between gap-2">
        <Skeleton className="h-10 w-[6.25rem] rounded-md" />
        <Skeleton className="h-9 w-[8.625rem] rounded-md" />
      </div>

      <Skeleton className="aspect-[16/9] w-full rounded-md" />
    </div>
  );
}

async function DepositStatsComponent() {
  const [dailyData, revenue] = await Promise.all([data.getDepositDailyData(), data.getRevenue()]);
  if (!dailyData || !revenue) return null;

  const currentDailyData = dailyData[dailyData.length - 1];
  if (!currentDailyData) return null;

  return (
    <>
      <DepositStats apy={currentDailyData.apy} tvl={currentDailyData.tvl} revenue={BigInt(revenue)} />
      <DiamondSeparator />
    </>
  );
}

function DepositStatsSkeleton() {
  return (
    <DepositInfoSection title="Stats" icon={<ChartIcon />}>
      <Skeleton className="h-[4.5rem] w-full rounded-md" />
    </DepositInfoSection>
  );
}

async function DepositAllocationComponent() {
  const allocations = await data.getAssetAllocation();
  if (!allocations) return null;

  const { outstandingPrincipal, usdcBalance, m0Balance } = allocations;

  return (
    <>
      <DepositAllocation
        outstandingPrincipal={BigInt(outstandingPrincipal)}
        treasuryBills={BigInt(m0Balance)}
        usdcBalance={BigInt(usdcBalance)}
      />

      <DiamondSeparator />
    </>
  );
}

function DepositAllocationSkeleton() {
  return (
    <DepositInfoSection title="Asset Allocation" icon={<PieChartIcon />}>
      <div className="flex flex-col gap-3">
        <div className="px-3">
          <Skeleton className="h-4 w-full rounded-md" />
        </div>

        <Skeleton className="h-[10.625rem] w-full rounded-md" />
      </div>
    </DepositInfoSection>
  );
}

function DiamondSeparator() {
  return (
    <Separator>
      <DiamondIcon className="size-3 text-neutral-300" />
    </Separator>
  );
}
