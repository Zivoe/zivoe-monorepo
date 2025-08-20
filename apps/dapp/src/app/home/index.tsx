import { data } from '@/server/data';

import Hero from '@/components/hero';
import Page from '@/components/page';

import Deposit from './deposit';
import DepositInfo from './deposit-info';
import { DepositPageView } from './deposit/_utils';

export default function Home({ initialView }: { initialView: DepositPageView }) {
  return (
    <div className="bg-surface-base">
      <Hero title="zVLT" description="Gain exposure to consumer credit" />

      <Page className="flex gap-10 lg:flex-row">
        <DepositInfo />
        <DepositWrapper initialView={initialView} />
      </Page>
    </div>
  );
}

async function DepositWrapper({ initialView }: { initialView: DepositPageView }) {
  let apy: number | null = null;

  const dailyData = await data.getDepositDailyData();

  if (dailyData) {
    const currentDailyData = dailyData[dailyData.length - 1];
    if (currentDailyData) {
      apy = currentDailyData.apy;
    }
  }

  return <Deposit apy={apy} initialView={initialView} />;
}
