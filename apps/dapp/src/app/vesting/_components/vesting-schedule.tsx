'use client';

import { ReactNode } from 'react';

import { CheckIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { useAccount } from '@/hooks/useAccount';
import { useBlockchainTimestamp } from '@/hooks/useBlockchainTimestamp';

import { Card } from '@/app/transparency/_components/card';

import { useVestingSchedule } from '../_hooks/useVestingSchedule';

type MilestoneState = 'COMPLETED' | 'CURRENT' | 'UPCOMING';

function getMilestoneProps(
  milestone: { title: string; timestamp: bigint; state: MilestoneState },
  index: number,
  milestones: Array<{ title: string; timestamp: bigint; state: MilestoneState }>
) {
  const nextMilestone = milestones[index + 1];
  const shouldShowTealLine = nextMilestone
    ? nextMilestone.state === 'COMPLETED' || nextMilestone.state === 'CURRENT'
    : milestone.state === 'COMPLETED';
  const isLast = index === milestones.length - 1;

  return { shouldShowTealLine, isLast };
}

export function VestingSchedule() {
  const account = useAccount();
  const { data: vestingSchedule } = useVestingSchedule();
  const { data: blockchainTimestamp } = useBlockchainTimestamp();

  if (account.isDisconnected || !vestingSchedule || !blockchainTimestamp) return null;

  const getMilestoneState = (index: number): MilestoneState => {
    const { start, cliff, end } = vestingSchedule;

    switch (index) {
      case 0:
        return 'COMPLETED';

      case 1:
        if (blockchainTimestamp >= cliff) return 'COMPLETED';
        if (blockchainTimestamp >= start) return 'CURRENT';
        return 'UPCOMING';

      case 2:
        if (blockchainTimestamp >= end) return 'COMPLETED';
        if (blockchainTimestamp >= cliff) return 'CURRENT';
        return 'UPCOMING';

      default:
        return 'UPCOMING';
    }
  };

  const milestones: Array<{ title: string; timestamp: bigint; state: MilestoneState }> = [
    {
      title: 'Vesting Schedule Created',
      timestamp: vestingSchedule.start,
      state: getMilestoneState(0)
    },
    {
      title: 'Cliff Ends',
      timestamp: vestingSchedule.cliff,
      state: getMilestoneState(1)
    },
    {
      title: 'Vesting Ends',
      timestamp: vestingSchedule.end,
      state: getMilestoneState(2)
    }
  ];

  return (
    <Card>
      <Card.Header title="Schedule" />

      <CardBody>
        {/* Mobile: Vertical Timeline */}
        <div className="md:hidden">
          <div className="flex flex-col">
            {milestones.map((milestone, index) => {
              const props = getMilestoneProps(milestone, index, milestones);
              return <MobileTimelineItem key={index} milestone={milestone} {...props} />;
            })}
          </div>
        </div>

        {/* Desktop: Horizontal Timeline */}
        <div className="relative hidden md:flex md:items-start">
          {milestones.map((milestone, index) => {
            const props = getMilestoneProps(milestone, index, milestones);
            return <DesktopTimelineItem key={index} milestone={milestone} {...props} />;
          })}
        </div>
      </CardBody>
    </Card>
  );
}

type MobileTimelineItemProps = {
  milestone: { title: string; timestamp: bigint; state: MilestoneState };
  isLast: boolean;
  shouldShowTealLine: boolean;
};

function MobileTimelineItem({ milestone, isLast, shouldShowTealLine }: MobileTimelineItemProps) {
  return (
    <div className="flex gap-3">
      {/* Left: Circle + Vertical Line */}
      <div className="flex flex-col items-center">
        {/* Milestone Indicator Circle */}
        <div className="relative z-10 flex size-5 shrink-0 items-center justify-center">
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              milestone.state === 'COMPLETED' || milestone.state === 'CURRENT'
                ? 'bg-element-primary-soft'
                : 'bg-surface-elevated-high-contrast'
            )}
          />
          {milestone.state === 'COMPLETED' && <CheckIcon className="relative z-10 size-4 text-base" />}
          {(milestone.state === 'CURRENT' || milestone.state === 'UPCOMING') && (
            <div className="relative z-10 size-2 rounded-full bg-surface-base" />
          )}
        </div>

        {/* Vertical Line */}
        {!isLast && (
          <div className="relative mt-1 h-20 w-0.5">
            {/* Gray background line */}
            <div className="absolute inset-0 bg-surface-elevated-high-contrast" />
            {/* Teal overlay line */}
            {shouldShowTealLine && <div className="absolute inset-0 bg-element-primary-soft" />}
          </div>
        )}
      </div>

      {/* Right: Milestone Info */}
      <div className={cn('flex flex-col gap-1 pt-0.5', !isLast && 'pb-4')}>
        <p className="text-small font-medium text-primary">{milestone.title}</p>
        <div className="flex items-center gap-2">
          <p className="text-small text-secondary">{formatUTCDate(milestone.timestamp)}</p>
          <div className="size-1.5 rotate-45 bg-element-neutral-emphasis" />
          <p className="text-small text-secondary">{formatUTCTime(milestone.timestamp)}</p>
        </div>
      </div>
    </div>
  );
}

type DesktopTimelineItemProps = {
  milestone: { title: string; timestamp: bigint; state: MilestoneState };
  isLast: boolean;
  shouldShowTealLine: boolean;
};

function DesktopTimelineItem({ milestone, isLast, shouldShowTealLine }: DesktopTimelineItemProps) {
  return (
    <div className={cn('relative flex flex-1 flex-col gap-8')}>
      {/* Milestone Indicator and Line Container */}
      <div className="relative flex items-center">
        {/* Milestone Indicator Circle */}
        <div className="relative z-10 flex size-5 shrink-0 items-center justify-center">
          <div
            className={cn(
              'absolute inset-0 rounded-full',
              milestone.state === 'COMPLETED' || milestone.state === 'CURRENT'
                ? 'bg-element-primary-soft'
                : 'bg-surface-elevated-high-contrast'
            )}
          />
          {milestone.state === 'COMPLETED' && <CheckIcon className="relative z-10 size-4 text-base" />}
          {(milestone.state === 'CURRENT' || milestone.state === 'UPCOMING') && (
            <div className="relative z-10 size-2 rounded-full bg-surface-base" />
          )}
        </div>

        {/* Horizontal Line */}
        {!isLast && (
          <div className="relative h-0.5 flex-1">
            {/* Gray background line */}
            <div className="absolute inset-0 bg-surface-elevated-high-contrast" />
            {/* Teal overlay line */}
            {shouldShowTealLine && <div className="absolute inset-0 bg-element-primary-soft" />}
          </div>
        )}
      </div>

      {/* Milestone Info */}
      <div className="flex flex-col gap-1">
        <p className="text-small font-medium text-primary">{milestone.title}</p>
        <div className="flex items-center gap-2">
          <p className="text-small text-secondary">{formatUTCDate(milestone.timestamp)}</p>
          <div className="size-1.5 rotate-45 bg-element-neutral-emphasis" />
          <p className="text-small text-secondary">{formatUTCTime(milestone.timestamp)}</p>
        </div>
      </div>
    </div>
  );
}

function CardBody({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={cn('rounded-[4px] bg-surface-base px-6 py-8 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]', className)}
    >
      {children}
    </div>
  );
}

export function VestingScheduleSkeleton() {
  return (
    <Card>
      <Card.Header title="Schedule" />

      <CardBody className="h-[10rem] animate-pulse" />
    </Card>
  );
}

function formatUTCDate(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

function formatUTCTime(timestamp: bigint): string {
  const date = new Date(Number(timestamp) * 1000);
  const time = date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC'
  });
  return `${time} UTC`;
}
