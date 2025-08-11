import { Suspense } from 'react';

import { Separator } from '@zivoe/ui/core/separator';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { DiamondIcon, PieChartIcon } from '@zivoe/ui/icons';

import { data } from '@/server/data';

import InfoSection from '@/components/info-section';

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

      <DiamondSeparator />

      <Suspense fallback={<DepositStats isLoading />}>
        <DepositStatsComponent />
      </Suspense>

      <DiamondSeparator />

      <DepositAbout />
      <DiamondSeparator />

      <DepositHighlights />
      <DiamondSeparator />

      <DepositDetails />
      <DiamondSeparator />

      <Suspense fallback={<DepositAllocationSkeleton />}>
        <DepositAllocationComponent />
      </Suspense>

      <DiamondSeparator />

      <Documents />
      <DiamondSeparator />

      <DepositContact />
    </div>
  );
}

async function DepositChartsComponent() {
  const dailyData = await data.getDepositDailyData();
  if (!dailyData) return null;

  return <DepositCharts dailyData={dailyData} />;
}

function DepositChartsSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex justify-between gap-2">
        <Skeleton className="h-10 w-36 rounded-md" />
        <Skeleton className="h-9 w-[8.625rem] rounded-full" />
      </div>

      <div className="relative aspect-[16/9] w-full">
        <svg className="h-full w-full" viewBox="0 0 800 450" preserveAspectRatio="none">
          <defs>
            <linearGradient id="deposit-skeleton-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--neutral-300))" stopOpacity="0.3" />
              <stop offset="95%" stopColor="hsl(var(--neutral-300))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Mobile path - fewer waves */}
          <path
            d="M 0 265 C 100 190, 200 190, 300 265 C 400 340, 500 340, 600 265 C 700 190, 750 190, 800 265 L 800 450 L 0 450 Z"
            fill="url(#deposit-skeleton-gradient)"
            className="animate-[pulse_1.5s_ease-in-out_infinite] md:hidden"
          />

          {/* Desktop path - more waves */}
          <path
            d="M 0 265 C 50 190, 100 190, 150 265 C 200 340, 250 340, 300 265 C 350 190, 400 190, 450 265 C 500 340, 550 340, 600 265 C 650 190, 700 190, 750 265 C 775 340, 800 340, 800 265 L 800 450 L 0 450 Z"
            fill="url(#deposit-skeleton-gradient)"
            className="hidden animate-[pulse_1.5s_ease-in-out_infinite] md:block"
          />

          {/* Mobile stroke - fewer waves */}
          <path
            d="M 0 265 C 100 190, 200 190, 300 265 C 400 340, 500 340, 600 265 C 700 190, 750 190, 800 265"
            fill="none"
            stroke="hsl(var(--neutral-300))"
            strokeWidth="2"
            strokeOpacity="0.6"
            className="animate-[pulse_1.5s_ease-in-out_infinite] md:hidden"
          />

          {/* Desktop stroke - more waves */}
          <path
            d="M 0 265 C 50 190, 100 190, 150 265 C 200 340, 250 340, 300 265 C 350 190, 400 190, 450 265 C 500 340, 550 340, 600 265 C 650 190, 700 190, 750 265 C 775 340, 800 340, 800 265"
            fill="none"
            stroke="hsl(var(--neutral-300))"
            strokeWidth="2"
            strokeOpacity="0.6"
            className="hidden animate-[pulse_1.5s_ease-in-out_infinite] md:block"
          />
        </svg>
      </div>
    </div>
  );
}

async function DepositStatsComponent() {
  const [dailyData, revenue] = await Promise.all([data.getDepositDailyData(), data.getRevenue()]);
  if (!dailyData || !revenue) return null;

  const currentDailyData = dailyData[dailyData.length - 1];
  if (!currentDailyData) return null;

  return <DepositStats apy={currentDailyData.apy} tvl={currentDailyData.tvl} revenue={BigInt(revenue)} />;
}

async function DepositAllocationComponent() {
  const allocations = await data.getAssetAllocation();
  if (!allocations) return null;

  const { outstandingPrincipal, usdcBalance, m0Balance } = allocations;

  return (
    <DepositAllocation
      outstandingPrincipal={BigInt(outstandingPrincipal)}
      treasuryBills={BigInt(m0Balance)}
      usdcBalance={BigInt(usdcBalance)}
    />
  );
}

function DepositAllocationSkeleton() {
  return (
    <InfoSection title="Asset Allocation" icon={<PieChartIcon />}>
      <div className="flex flex-col gap-3">
        <div className="px-3">
          <Skeleton className="h-4 w-full rounded-md" />
        </div>

        <Skeleton className="h-[10.625rem] w-full rounded-md" />
      </div>
    </InfoSection>
  );
}

function DiamondSeparator() {
  return (
    <Separator>
      <DiamondIcon className="size-3 text-neutral-300" />
    </Separator>
  );
}
