'use client';

import { ReactNode } from 'react';

import { CheckIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { useAccount } from '@/hooks/useAccount';

import { Card } from '@/app/transparency/_components/card';

import { useVestingSchedule } from '../_hooks/useVestingSchedule';

export function VestingSchedule() {
  const account = useAccount();
  const { data: vestingSchedule } = useVestingSchedule();

  if (account.isDisconnected || !vestingSchedule) return null;

  const milestones: Array<{ title: string; timestamp: bigint }> = [
    {
      title: 'Vesting Schedule Created',
      timestamp: vestingSchedule.start
    },
    {
      title: 'Cliff Starts',
      timestamp: vestingSchedule.start
    },
    {
      title: 'Cliff Ends',
      timestamp: vestingSchedule.cliff
    },
    {
      title: 'Vesting Start',
      timestamp: vestingSchedule.cliff
    },
    {
      title: 'Vesting Ends',
      timestamp: vestingSchedule.end
    }
  ];

  return (
    <Card>
      <Card.Header title="Schedule" />

      <CardBody>
        <div className="relative flex items-start justify-between">
          {/* Progress Line - Behind everything */}
          <div className="absolute inset-x-0 top-2.5 h-0.5 bg-element-primary-soft" />

          {/* Milestones */}
          {milestones.map((milestone, index) => (
            <div key={index} className="relative flex flex-col gap-8">
              {/* Milestone Indicator */}
              <div className="relative z-10 flex size-5 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-element-primary-soft" />
                <CheckIcon className="relative z-10 size-4 text-base" />
              </div>

              {/* Milestone Info */}
              <div className="flex flex-col gap-1">
                <p className="text-small font-medium text-primary">{milestone.title}</p>
                <div className="flex items-center gap-2">
                  <p className="text-small text-secondary">{formatUTCDate(milestone.timestamp)}</p>
                  <div className="size-1.5 rotate-45 bg-surface-elevated-contrast" />
                  <p className="text-small text-secondary">{formatUTCTime(milestone.timestamp)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
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
