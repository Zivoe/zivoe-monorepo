import { ReactNode } from 'react';

import { BankIcon, ChartIcon, TrendingIcon } from '@zivoe/ui/icons';

import { customNumber, formatBigIntToReadable } from '@/lib/utils';

import { DepositInfoSection } from './common';

export default function DepositStats({ apy, tvl }: { apy: number; tvl: string }) {
  return (
    <DepositInfoSection title="Stats" icon={<ChartIcon />}>
      <div className="flex justify-between gap-4">
        <Box title="TVL" icon={<BankIcon />} value={'$' + formatBigIntToReadable(BigInt(tvl))} />
        <Box title="APY" icon={<TrendingIcon />} value={customNumber(apy) + '%'} />
        <Box title="TVL" icon={<BankIcon />} value={'$' + formatBigIntToReadable(BigInt(tvl))} />
      </div>
    </DepositInfoSection>
  );
}

function Box({ title, icon, value }: { title: string; icon: ReactNode; value: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 [&_svg]:size-5 [&_svg]:text-secondary-contrast">
        {icon}
        <p className="text-regular text-secondary">{title}</p>
      </div>

      <p className="!font-heading text-h6 text-primary xl:text-h5">{value}</p>
    </div>
  );
}
