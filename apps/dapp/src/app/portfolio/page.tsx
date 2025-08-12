import Page from '@/components/page';

import { PortfolioChart } from './_components/portfolio-chart';
import { PortfolioHeader } from './_components/portfolio-header';
import { PortfolioHoldings } from './_components/portfolio-holdings';

export default function Portfolio() {
  return (
    <div className="bg-surface-base">
      <Page className="flex gap-10">
        <PortfolioHeader />
        <PortfolioChart />
        <PortfolioHoldings />
      </Page>
    </div>
  );
}
