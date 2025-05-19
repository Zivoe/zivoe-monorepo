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
  const dailyData = await data.getDepositDailyData();

  const currentDailyData = dailyData[dailyData.length - 1];
  if (!currentDailyData) return null;

  const revenue = await data.getRevenue();

  return (
    <div className="flex w-full flex-col gap-8 lg:gap-10">
      <DepositCharts dailyData={dailyData} />

      <DiamondSeparator />
      <DepositStats apy={currentDailyData.apy} tvl={currentDailyData.tvl} revenue={revenue} />

      <DiamondSeparator />
      <DepositAbout />

      <DiamondSeparator />
      <DepositHighlights />

      <DiamondSeparator />
      <DepositDetails />

      <DiamondSeparator />
      <DepositAllocation />

      <DiamondSeparator />
      <Documents />

      <DiamondSeparator />
      <DepositContact />
    </div>
  );
}

function DiamondSeparator() {
  return (
    <Separator>
      <DiamondIcon className="size-3 text-neutral-300" />
    </Separator>
  );
}
