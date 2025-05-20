import Hero from '@/components/hero';
import Page from '@/components/page';

import Deposit from './deposit';
import DepositInfo from './deposit-info';

export default function Home() {
  return (
    <>
      <Hero title="zVLT" description="A nonprime consumer credit fund." />

      <Page className="flex gap-10 lg:flex-row">
        <DepositInfo />
        <Deposit />
      </Page>
    </>
  );
}
