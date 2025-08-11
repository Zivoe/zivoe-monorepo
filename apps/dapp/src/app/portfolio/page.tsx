import Page from '@/components/page';

import PortfolioComponent from './component';

export default function Portfolio() {
  return (
    <div className="bg-surface-base">
      <Page className="flex gap-10 lg:flex-row">
        <PortfolioComponent />
      </Page>
    </div>
  );
}
