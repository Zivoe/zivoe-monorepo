import { connection } from 'next/server';

import { Separator } from '@zivoe/ui/core/separator';
import { DiamondIcon } from '@zivoe/ui/icons';

import { data } from '@/server/data';

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
      <DepositAllocationComponent />

      <DiamondSeparator />
      <Documents />

      <DiamondSeparator />
      <DepositContact />
    </div>
  );
}

async function DepositChartsComponent() {
  const dailyData = await data.getDepositDailyData();
  return <DepositCharts dailyData={dailyData} />;
}

async function DepositStatsComponent() {
  const [dailyData, revenue] = await Promise.all([data.getDepositDailyData(), data.getRevenue()]);

  const currentDailyData = dailyData[dailyData.length - 1];
  if (!currentDailyData) return null;

  return <DepositStats apy={currentDailyData.apy} tvl={currentDailyData.tvl} revenue={revenue} />;
}

async function DepositAllocationComponent() {
  const { outstandingPrincipal, usdcBalance, m0Balance } = await data.getAssetAllocation();

  return (
    <DepositAllocation
      outstandingPrincipal={outstandingPrincipal}
      treasuryBills={m0Balance}
      usdcBalance={usdcBalance}
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
