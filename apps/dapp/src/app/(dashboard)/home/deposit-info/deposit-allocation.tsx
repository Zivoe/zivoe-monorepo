'use client';

import { ReactElement } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { PieChartIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { CurrentDailyData } from '@/server/data';

import { formatBigIntToReadable } from '@/lib/utils';

import InfoSection from '@/components/info-section';

export default function DepositAllocation({ loans, stablecoins, treasuryBills, deFi }: CurrentDailyData['tvl']) {
  const allocations = [
    {
      label: 'Loans',
      percentage: loans.percentage,
      value: loans.total,
      bgColor: 'bg-element-primary-soft'
    },
    {
      label: 'Treasury Bills',
      percentage: treasuryBills.percentage,
      value: treasuryBills.total,
      bgColor: 'bg-element-tertiary-contrast'
    },
    {
      label: 'Stablecoins',
      percentage: stablecoins.percentage,
      value: stablecoins.total,
      bgColor: 'bg-element-secondary'
    },
    {
      label: 'DeFi',
      percentage: deFi.percentage,
      value: deFi.total,
      bgColor: 'bg-element-warning-soft'
    }
  ].sort((a, b) => b.percentage - a.percentage);

  return (
    <InfoSection title="Asset Allocation" icon={<PieChartIcon />}>
      <div className="flex flex-col gap-3">
        <div className="flex h-4 gap-1 px-3">
          {allocations.map((allocation, index) => (
            <Block key={index} width={allocation.percentage} className={allocation.bgColor} />
          ))}
        </div>

        <div>
          {allocations.map((allocation, index) => (
            <Allocation
              key={index}
              label={
                allocation.label === 'Treasury Bills' ? (
                  <>
                    Treasury Bills (
                    <Link
                      href="https://dashboard.m0.org/"
                      target="_blank"
                      hideExternalLinkIcon
                      className="text-regular sm:text-leading"
                    >
                      $wM by M0
                    </Link>
                    )
                  </>
                ) : (
                  allocation.label
                )
              }
              percentage={allocation.percentage.toFixed(2)}
              value={'$' + formatBigIntToReadable(allocation.value)}
              className={index < allocations.length - 1 ? 'border-b border-default' : ''}
              bulletClassName={allocation.bgColor}
            />
          ))}
        </div>
      </div>
    </InfoSection>
  );
}

function Block({ width, className }: { width: number; className: string }) {
  return <div className={cn('rounded-md', className)} style={{ width: `${width}%` }} />;
}

function Allocation({
  label,
  percentage,
  value,
  className,
  bulletClassName
}: {
  label: string | ReactElement;
  percentage: string;
  value: string;
  className?: string;
  bulletClassName?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-2 py-3 sm:px-3 sm:py-4', className)}>
      <div className="flex items-center gap-3">
        <div className={cn('size-3 rounded-full', bulletClassName)} />
        <p className="text-regular text-secondary sm:text-leading">{label}</p>
      </div>

      <div className="flex gap-2">
        <p className="text-regular text-secondary sm:text-leading">{percentage}%</p>
        <p className="text-regular text-primary sm:text-leading">{value}</p>
      </div>
    </div>
  );
}
