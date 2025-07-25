import { Suspense } from 'react';

import { Skeleton } from '@zivoe/ui/core/skeleton';

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

        <Suspense
          fallback={
            <Skeleton className="sticky top-14 hidden h-[27rem] rounded-2xl p-2 lg:block lg:min-w-[24.75rem] xl:min-w-[39.375rem]" />
          }
        >
          <DepositWrapper />
        </Suspense>
      </Page>
    </div>
  );
}

async function DepositWrapper() {
  let apy: number | null = null;

  const dailyData = await data.getDepositDailyData();

  if (dailyData) {
    const currentDailyData = dailyData[dailyData.length - 1];
    if (currentDailyData) apy = currentDailyData.apy;
  }

  return <Deposit apy={apy} />;
}
