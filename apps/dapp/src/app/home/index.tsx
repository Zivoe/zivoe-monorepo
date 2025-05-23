import { Suspense } from 'react';

import Hero from '@/components/hero';
import Page from '@/components/page';

import Deposit from './deposit';
import DepositInfo from './deposit-info';

export default function Home() {
  return (
    <>
      <Hero title="zVLT" description="Gain exposure to non-prime consumer credit" />

      <Suspense>
        <Page className="flex gap-10 lg:flex-row">
          <DepositInfo />
          <Deposit />
        </Page>
      </Suspense>
    </>
  );
}
