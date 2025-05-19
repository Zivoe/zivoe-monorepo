import { data } from '@/server/data';

import DepositCharts from './deposit-charts';

export default async function DepositInfo() {
  const dailyData = await data.getDepositDailyData();

  return (
    <div className="flex w-full">
      <DepositCharts dailyData={dailyData} />
    </div>
  );
}
