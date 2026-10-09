import LoadingStatus from '@/components/loading-status';
import Page from '@/components/page';

import { Actions } from './actions';
import { ActivitySkeleton } from './activity';
import { BalanceChartSkeleton } from './balance-chart';
import { PortfolioHeroSkeleton } from './hero';
import { PortfolioGrid } from './portfolio-grid';
import { type PortfolioVaultLink } from './portfolio-view';
import { RedemptionsSkeleton } from './redemptions';
import { TokensSkeleton } from './tokens';

/**
 * The page while its data is on its way — the route's `loading.tsx` and the
 * moment before the wallet SDK has settled. Each card is its own silhouette
 * (the hero's figure, the chart's gridlines, token rows, a request strip,
 * activity rows) and Actions, which needs no data, renders for real, so the
 * loading and loaded pages share one layout and nothing jumps when the
 * figures land.
 */
export function PortfolioSkeleton({
  zivoeVault,
  shareSymbol
}: {
  zivoeVault: PortfolioVaultLink;
  shareSymbol: string;
}) {
  return (
    <>
      <LoadingStatus />
      <PortfolioHeroSkeleton />

      <Page className="gap-6">
        <PortfolioGrid
          main={
            <>
              <BalanceChartSkeleton shareSymbol={shareSymbol} />
              <TokensSkeleton />
            </>
          }
          aside={
            <>
              <Actions zivoeVault={zivoeVault} />
              <RedemptionsSkeleton />
              <ActivitySkeleton />
            </>
          }
        />
      </Page>
    </>
  );
}
