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
  if (!dailyData) return null;

  return <DepositCharts dailyData={dailyData} />;
}

async function DepositStatsComponent() {
  const [dailyData, revenue] = await Promise.all([data.getDepositDailyData(), data.getRevenue()]);
  if (!dailyData || !revenue) return null;

  const currentDailyData = dailyData[dailyData.length - 1];
  if (!currentDailyData) return null;

  return <DepositStats apy={currentDailyData.apy} tvl={currentDailyData.tvl.total} revenue={BigInt(revenue)} />;
}

async function DepositAllocationComponent() {
  const dailyData = await data.getDepositDailyData();

  const currentTVL = dailyData?.[dailyData.length - 1]?.tvl;
  if (!currentTVL) return null;

  const { total, loans, stablecoins, treasuryBills, deFi } = currentTVL;

  return (
    <DepositAllocation
      total={BigInt(total)}
      loans={BigInt(loans.total)}
      treasuryBills={BigInt(treasuryBills.total)}
      stablecoins={BigInt(stablecoins.total)}
      deFi={BigInt(deFi.total)}
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
