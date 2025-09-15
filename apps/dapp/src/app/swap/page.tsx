import Page from '@/components/page';

import { CowSwapTradingWidget } from '@/app/swap/_components/cowswap-widget';
import { CowswapElementLeft } from '@/app/swap/_components/element-left';
import { CowswapElementRight } from '@/app/swap/_components/element-right';

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
