import { Separator } from '@zivoe/ui/core/separator';
import { DiamondIcon } from '@zivoe/ui/icons';

import { data } from '@/server/data';

import DepositCharts from './deposit-charts';
import DepositAbout from './deposit-stats';

export default async function DepositInfo() {
  const dailyData = await data.getDepositDailyData();

  const currentDailyData = dailyData[dailyData.length - 1];
  if (!currentDailyData) return null;

  return (
    <div className="flex w-full flex-col gap-10">
      <DepositCharts dailyData={dailyData} />
      <DiamondSeparator />
      <DepositAbout apy={currentDailyData.apy} tvl={currentDailyData.tvl} />
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
