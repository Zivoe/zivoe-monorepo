import { type ReactNode } from 'react';

import { BankIcon, ChartIcon, MoneyIcon, TrendingIcon } from '@zivoe/ui/icons';

import { formatNav, formatTokenPrice } from '@/lib/utils';

import InfoSection from '@/components/info-section';
import TargetApyDisclosure from '@/components/target-apy-disclosure';

export default function DepositStats({
  nav,
  sharePrice,
  targetApyPercent
}: {
  nav: number;
  sharePrice: number;
  targetApyPercent: number;
}) {
  return (
    <InfoSection title="Stats" icon={<ChartIcon />}>
      {/* Full NAV amounts can outgrow narrow viewports; wrapping beats
          clipping since no box can shrink (whitespace-nowrap values). */}
      <div className="flex flex-wrap justify-between gap-4">
        <Box title="NAV" icon={<BankIcon />} value={`$${formatNav(nav)}`} />

        <Box
          title="Target APY"
          icon={<TrendingIcon />}
          value={`${targetApyPercent}%`}
          help={<TargetApyDisclosure triggerClassName="-ml-1" />}
        />

        <Box title="Token Price" icon={<MoneyIcon />} value={`$${formatTokenPrice(sharePrice)}`} />
      </div>
    </InfoSection>
  );
}

function Box({ title, icon, value, help }: { title: string; icon: ReactNode; value: string; help?: ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        {/* Scoped to the leading icon so the help trigger keeps its own smaller size. */}
        <span className="[&_svg]:size-5 [&_svg]:text-secondary-contrast">{icon}</span>

        <p className="text-regular whitespace-nowrap text-secondary">{title}</p>

        {help}
      </div>

      <p className="font-heading! text-h6 whitespace-nowrap text-primary xl:text-h5">{value}</p>
    </div>
  );
}
