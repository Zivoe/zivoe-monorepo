import { CowSwapTradingWidget } from 'archived/swap/_components/cowswap-widget';
import { CowswapElementLeft } from 'archived/swap/_components/element-left';
import { CowswapElementRight } from 'archived/swap/_components/element-right';

import Page from '@/components/page';

export default function SwapPage() {
  return (
    <div className="bg-surface-base">
      <Page className="flex items-center">
        <CowSwapTradingWidget />

        <div className="absolute bottom-0 left-0 hidden lg:block">
          <CowswapElementLeft />
        </div>

        <div className="absolute bottom-0 right-0 hidden lg:block">
          <CowswapElementRight />
        </div>
      </Page>
    </div>
  );
}
