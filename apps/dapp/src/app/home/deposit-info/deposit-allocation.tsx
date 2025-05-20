'use client';

import { PieChartIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { DepositInfoSection } from './common';

const a = 80;
const b = 15;
const c = 5;

export default function DepositAllocation() {
  return (
    <DepositInfoSection title="Asset Allocation" icon={<PieChartIcon />}>
      <div className="flex flex-col gap-3">
        <div className="flex h-4 gap-1 px-3">
          <Block width={a} className="bg-element-primary-soft" />
          <Block width={b} className="bg-element-secondary" />
          <Block width={c} className="bg-element-tertiary-contrast" />
        </div>

        <div>
          <Allocation
            label="Loans"
            percentage={a}
            value="$6,0023,121.12"
            className="border-b border-default"
            bulletClassName="bg-element-primary-soft"
          />

          <Allocation
            label="Treasury Bills (M0)"
            percentage={b}
            value="$1,203.12"
            className="border-b border-default"
            bulletClassName="bg-element-secondary"
          />

          <Allocation label="USDC" percentage={c} value="$1,203.12" bulletClassName="bg-element-tertiary-contrast" />
        </div>
      </div>
    </DepositInfoSection>
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
  label: string;
  percentage: number;
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
