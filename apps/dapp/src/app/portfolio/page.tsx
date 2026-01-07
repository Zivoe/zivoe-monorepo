import { AppShell } from '@/components/app-shell';
import OnboardingGuard from '@/components/onboarding-guard';
import Page from '@/components/page';

import { PortfolioChart } from './_components/portfolio-chart';
import { PortfolioHeader } from './_components/portfolio-header';
import { PortfolioHoldings } from './_components/portfolio-holdings';

export default async function Portfolio() {
  return (
    <>
      <AppShell>
        <div className="bg-surface-base">
          <Page className="flex gap-10">
            <PortfolioHeader />
            <PortfolioChart />
            <PortfolioHoldings />
          </Page>
        </div>
      </AppShell>

      <OnboardingGuard />
    </>
  );
}
