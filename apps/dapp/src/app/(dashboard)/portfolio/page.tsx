import Page from '@/components/page';

import { OnboardingGuard } from '../_components/onboarding-guard';
import { PortfolioChart } from './_components/portfolio-chart';
import { PortfolioHeader } from './_components/portfolio-header';
import { PortfolioHoldings } from './_components/portfolio-holdings';

export default function Portfolio() {
  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <Page className="flex gap-10">
          <PortfolioHeader />
          <PortfolioChart />
          <PortfolioHoldings />
        </Page>
      </div>
    </>
  );
}
