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

      <p className="text-regular text-secondary">{currentEndOfDayUTCString} (UTC)</p>
    </HeaderContainer>
  );
}

function HeaderSkeleton() {
  return (
    <HeaderContainer>
      <Skeleton className="h-10 w-44 rounded-md" />
      <Skeleton className="h-6 w-[8.75rem] rounded-md" />
    </HeaderContainer>
  );
}

function HeaderContainer({ children }: { children: React.ReactNode }) {
  return (
    <InfoSection title="zVLT Value" icon={<PiggyBankIcon />}>
      <div className="flex flex-col gap-2">{children}</div>
    </InfoSection>
  );
}
