'use client';

import { ReactNode } from 'react';

import { ContextualHelp, ContextualHelpDescription, ContextualHelpTitle } from '@zivoe/ui/core/contextual-help';
import { Skeleton } from '@zivoe/ui/core/skeleton';

import { formatBigIntWithCommas } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';

import { TOKEN_INFO } from '@/components/token-info';

import { Card } from '@/app/transparency/_components/card';

import { useVestingSchedule } from '../_hooks/useVestingSchedule';

export function VestingOverview() {
  const account = useAccount();
  const { data: vestingSchedule } = useVestingSchedule();

  const hasSchedule = !account.isDisconnected && !!vestingSchedule;

  return (
    <Card>
      <Card.Header title="Overview" />

      <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-2">
        <InfoCard
          title="ZVE Granted"
          value={
            !hasSchedule ? '-' : formatBigIntWithCommas({ value: vestingSchedule.totalVesting, showUnderZero: true })
          }
          tooltip={{ title: 'ZVE Granted', description: "The total number of tokens you're supposed to get." }}
        />

        <InfoCard
          title="Schedule Type"
          value={!hasSchedule ? '-' : vestingSchedule.revokable ? 'Revokable' : 'Non-Revokable'}
          tooltip={{
            title: 'Schedule Type',
            description: 'Revokable tokens can be taken back before they finish unlocking.'
          }}
        />

        <InfoCard
          title="ZVE Vested"
          value={
            !hasSchedule ? '-' : formatBigIntWithCommas({ value: vestingSchedule.vestedAmount, showUnderZero: true })
          }
          tooltip={{
            title: 'ZVE Vested',
            description: 'Amount of ZVE that has already been unlocked and is eligible to claim.'
          }}
        />

        <InfoCard
          title="Claimed so far"
          value={
            !hasSchedule ? (
              '-'
            ) : (
              <div className="flex items-center gap-2">
                <span className="[&_svg]:size-6 [&_svg]:flex-shrink-0">{TOKEN_INFO['zVLT'].icon}</span>
                <p className="text-smallSubheading font-medium text-primary">
                  {formatBigIntWithCommas({ value: vestingSchedule.totalWithdrawn, showUnderZero: true })}
                </p>
              </div>
            )
          }
          tooltip={{
            title: 'Claimed so far',
            description: 'Total amount of ZVE and USDC tokens already claimed by you.'
          }}
        />
      </div>
    </Card>
  );
}

export function VestingOverviewSkeleton() {
  return (
    <Card>
      <Card.Header title="Overview" />

      <div className="grid h-full grid-cols-1 gap-2 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <InfoCardContainer key={index}>
            <Skeleton className="h-5 w-24 rounded-md" />
            <Skeleton className="h-8 w-48 rounded-md" />
          </InfoCardContainer>
        ))}
      </div>
    </Card>
  );
}

function InfoCardContainer({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-24 flex-col justify-between rounded-[4px] bg-surface-base p-5 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
      {children}
    </div>
  );
}

function InfoCard({
  title,
  value,
  tooltip
}: {
  title: string;
  value: string | ReactNode;
  tooltip: { title: string; description: string };
}) {
  return (
    <InfoCardContainer>
      <div className="flex items-start justify-between gap-2">
        <p className="text-small font-medium text-secondary">{title}</p>

        <ContextualHelp variant="info">
          <ContextualHelpTitle>{tooltip.title}</ContextualHelpTitle>
          <ContextualHelpDescription>{tooltip.description}</ContextualHelpDescription>
        </ContextualHelp>
      </div>

      {typeof value === 'string' ? <p className="text-h6 text-primary">{value}</p> : value}
    </InfoCardContainer>
  );
}
