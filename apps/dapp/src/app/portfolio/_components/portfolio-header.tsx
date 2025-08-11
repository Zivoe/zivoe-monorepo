'use client';

import { Skeleton } from '@zivoe/ui/core/skeleton';
import { PiggyBankIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { formatBigIntWithCommas, getEndOfDayUTC } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import InfoSection from '@/components/info-section';

import { usePortfolio } from '../_hooks/usePortfolio';

export function PortfolioHeader() {
  const account = useAccount();
  const { data: portfolio, isFetching } = usePortfolio();

  if (account.isPending || isFetching) return <HeaderSkeleton />;

  const currentEndOfDayUTC = getEndOfDayUTC(new Date());
  const currentEndOfDayUTCString = currentEndOfDayUTC.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });

  return (
    <HeaderContainer>
      <p className="text-h4 text-primary">
        {portfolio?.value
          ? `$${formatBigIntWithCommas({ value: portfolio.value })}`
          : account.isDisconnected
            ? '$-'
            : '$0.00'}
      </p>

      <div className="flex items-center gap-1 text-regular">
        {portfolio?.change && (
          <span className={cn('font-medium', portfolio.change.isPositive ? 'text-brand-subtle' : 'text-alert-subtle')}>
            {portfolio.change.isPositive ? '+' : ''}
            {formatBigIntWithCommas({ value: portfolio.change.value, tokenDecimals: 2, displayDecimals: 2 })}%
          </span>
        )}

        <span className="text-secondary">
          {portfolio?.change ? 'on' : null} {currentEndOfDayUTCString} (UTC)
        </span>
      </div>
    </HeaderContainer>
  );
}

function HeaderSkeleton() {
  return (
    <HeaderContainer>
      <Skeleton className="h-10 w-44 rounded-md" />
      <Skeleton className="h-6 w-52 rounded-md" />
    </HeaderContainer>
  );
}

function HeaderContainer({ children }: { children: React.ReactNode }) {
  return (
    <InfoSection title="Portfolio Value" icon={<PiggyBankIcon />}>
      <div className="flex flex-col gap-2">{children}</div>
    </InfoSection>
  );
}
