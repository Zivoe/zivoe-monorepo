import { CowSwapTradingWidget } from '@/components/cowswap/cowswap-widget';
import Page from '@/components/page';

export default function SwapPage() {
  return (
    <div className="bg-surface-base">
      <Page className="flex items-center">
        <CowSwapTradingWidget />
      </Page>
    </div>
  );
}
