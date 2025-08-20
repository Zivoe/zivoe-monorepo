import { data } from '@/server/data';

import Hero from '@/components/hero';
import Page from '@/components/page';

import Deposit from './deposit';
import DepositInfo from './deposit-info';

export default function Home() {
  return (
    <div className="bg-surface-base">
      <Hero title="zVLT" description="Gain exposure to consumer credit" />

      <Page className="flex gap-10 lg:flex-row">
        <DepositInfo />
        <DepositWrapper />
      </Page>
    </div>
  );
}

async function DepositWrapper() {
  let apy: number | null = null;
  let indexPrice: number | null = null;

  const dailyData = await data.getDepositDailyData();

  if (dailyData) {
    const currentDailyData = dailyData[dailyData.length - 1];
    if (currentDailyData) {
      apy = currentDailyData.apy;
      indexPrice = currentDailyData.indexPrice;
    }
  }

  return <Deposit apy={apy} indexPrice={indexPrice} />;
}
