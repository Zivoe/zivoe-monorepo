import { Separator } from '@zivoe/ui/core/separator';
import { DiamondIcon } from '@zivoe/ui/icons';

import { data } from '@/server/data';

import DepositAbout from './deposit-about';
import DepositCharts from './deposit-charts';
import DepositStats from './deposit-stats';

export default async function DepositInfo() {
  const dailyData = await data.getDepositDailyData();

  const currentDailyData = dailyData[dailyData.length - 1];
  if (!currentDailyData) return null;

  return (
    <div className="flex w-full flex-col gap-10">
      <DepositCharts dailyData={dailyData} />

      <DiamondSeparator />
      <DepositStats apy={currentDailyData.apy} tvl={currentDailyData.tvl} />

      <DiamondSeparator />
      <DepositAbout />
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
