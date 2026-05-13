import { type ReactNode } from 'react';

import { BankIcon, ChartIcon, MoneyIcon, TrendingIcon } from '@zivoe/ui/icons';

import { formatBigIntToReadable } from '@/lib/utils';

import InfoSection from '@/components/info-section';

export default function DepositStats({ tvl, revenue }: { tvl: bigint; revenue: bigint }) {
  return (
    <InfoSection title="Stats" icon={<ChartIcon />}>
      <div className="flex justify-between gap-4">
        <Box title="TVL" icon={<BankIcon />} value={'$' + formatBigIntToReadable(tvl)} />
        <Box title="Target Net APY" icon={<TrendingIcon />} value="10-12%" />
        <Box title="Revenue" icon={<MoneyIcon />} value={'$' + formatBigIntToReadable(revenue, 6)} />
      </div>
    </InfoSection>
  );
}

function Box({ title, icon, value }: { title: string; icon: ReactNode; value: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2 [&_svg]:size-5 [&_svg]:text-secondary-contrast">
        {icon}
        <p className="whitespace-nowrap text-regular text-secondary">{title}</p>
      </div>

      <p className="whitespace-nowrap !font-heading text-h6 text-primary xl:text-h5">{value}</p>
    </div>
  );
}
