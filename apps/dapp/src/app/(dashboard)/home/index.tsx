import { data } from '@/server/data';

import Hero from '@/components/hero';
import Page from '@/components/page';

import Deposit from './deposit';
import DepositInfo from './deposit-info';
import { type DepositPageView } from './deposit/_utils';

export default function Home({ initialView }: { initialView: DepositPageView }) {
  return (
    <div className="bg-surface-base">
      <Hero title="zMCA" description="Gain exposure to private credit" />

      <Page className="flex gap-10 lg:flex-row">
        <DepositInfo />
        <DepositWrapper initialView={initialView} />
      </Page>
    </div>
  );
}

async function DepositWrapper({ initialView }: { initialView: DepositPageView }) {
  // 30-day Trailing APY from the shared current-share-metrics path; null until
  // 30 days of history exist (or on indexer failure — the card shows a dash).
  const metrics = await data.getCurrentShareMetrics();

  return <Deposit apy={metrics?.apy ?? null} initialView={initialView} />;
}
