import { type ReactNode } from 'react';

import { BankIcon, ChartIcon, MoneyIcon, TrendingIcon } from '@zivoe/ui/icons';

import { customNumber } from '@/lib/utils';

import InfoSection from '@/components/info-section';

export default function DepositStats({ nav, apy }: { nav: number; apy: number | null }) {
  return (
    <InfoSection title="Stats" icon={<ChartIcon />}>
      <div className="flex justify-between gap-4">
        <Box title="NAV" icon={<BankIcon />} value={`$${customNumber(nav)}`} />

        <Box title="30-day Trailing APY" icon={<TrendingIcon />} value={apy !== null ? `${customNumber(apy)}%` : '-'} />

        <Box title="Revenue" icon={<MoneyIcon />} value="-" />
      </div>
    </InfoSection>
  );
}

function Box({ title, icon, value }: { title: string; icon: ReactNode; value: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2 [&_svg]:size-5 [&_svg]:text-secondary-contrast">
        {icon}
        <p className="text-regular whitespace-nowrap text-secondary">{title}</p>
      </div>

      <p className="font-heading! text-h6 whitespace-nowrap text-primary xl:text-h5">{value}</p>
    </div>
  );
}
