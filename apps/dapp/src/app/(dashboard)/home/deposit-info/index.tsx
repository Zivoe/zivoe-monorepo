import { Separator } from '@zivoe/ui/core/separator';
import { DiamondIcon } from '@zivoe/ui/icons';

import { data } from '@/server/data';

import DepositAbout from './deposit-about';
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

      <Documents />
      <DiamondSeparator />

      <DepositContact />
    </div>
  );
}

async function DepositChartsComponent() {
  const snapshots = await data.getDepositDailySnapshots();
  if (!snapshots) return null;

  return <DepositCharts snapshots={snapshots} />;
}

async function DepositStatsComponent() {
  const [currentProtocolDailySnapshot, revenue] = await Promise.all([
    data.getCurrentDailySnapshot(),
    data.getRevenue()
  ]);
  if (!currentProtocolDailySnapshot || !revenue) return null;

  return <DepositStats tvl={currentProtocolDailySnapshot.tvl.total} revenue={BigInt(revenue)} />;
}

function DiamondSeparator() {
  return (
    <Separator>
      <DiamondIcon className="size-3 text-neutral-300" />
    </Separator>
  );
}
