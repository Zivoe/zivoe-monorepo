import { ReactNode } from 'react';

import { Skeleton } from '@zivoe/ui/core/skeleton';
import { BankIcon, ChartIcon, MoneyIcon, TrendingIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { customNumber, formatBigIntToReadable } from '@/lib/utils';

import InfoSection from '@/components/info-section';

export default function DepositStats(props: { isLoading: true } | { apy: number; tvl: string; revenue: bigint }) {
  const isLoading = 'isLoading' in props;

  return (
    <InfoSection title="Stats" icon={<ChartIcon />}>
      <div className="grid grid-cols-3 gap-4">
        <Box
          title="TVL"
          icon={<BankIcon />}
          {...(isLoading ? { isLoading } : { value: '$' + formatBigIntToReadable(BigInt(props.tvl)) })}
          className="justify-self-start"
        />
        <Box
          title="APY"
          icon={<TrendingIcon />}
          {...(isLoading ? { isLoading } : { value: customNumber(props.apy) + '%' })}
          className="justify-self-center"
        />
        <Box
          title="Revenue"
          icon={<MoneyIcon />}
          {...(isLoading ? { isLoading } : { value: '$' + formatBigIntToReadable(props.revenue, 6) })}
          className="justify-self-end"
        />
      </div>
    </InfoSection>
  );
}

function Box({
  title,
  icon,
  className,
  ...props
}: {
  title: string;
  icon: ReactNode;
  className: string;
} & ({ isLoading: true } | { value: string })) {
  const isLoading = 'isLoading' in props;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-center gap-2 [&_svg]:size-5 [&_svg]:text-secondary-contrast">
        {icon}
        <p className="text-regular text-secondary">{title}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-8 w-24 rounded-md sm:w-28 xl:h-10" />
      ) : (
        <p className="!font-heading text-h6 text-primary xl:text-h5">{props.value}</p>
      )}
    </div>
  );
}
