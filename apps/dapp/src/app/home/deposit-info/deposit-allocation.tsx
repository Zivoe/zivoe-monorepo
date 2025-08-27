'use client';

import { ReactElement } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { PieChartIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { formatBigIntToReadable } from '@/lib/utils';

import InfoSection from '@/components/info-section';

export default function DepositAllocation({
  total,
  loans,
  stablecoins,
  treasuryBills,
  deFi
}: {
  total: bigint;
  loans: bigint;
  stablecoins: bigint;
  treasuryBills: bigint;
  deFi: bigint;
}) {
  const loansPercentage = (Number(loans) / Number(total)) * 100;
  const stablecoinsPercentage = (Number(stablecoins) / Number(total)) * 100;
  const treasuryBillsPercentage = (Number(treasuryBills) / Number(total)) * 100;
  const deFiPercentage = (Number(deFi) / Number(total)) * 100;

  return (
    <InfoSection title="Asset Allocation" icon={<PieChartIcon />}>
      <div className="flex flex-col gap-3">
        <div className="flex h-4 gap-1 px-3">
          <Block width={loansPercentage} className="bg-element-primary-soft" />
          <Block width={treasuryBillsPercentage} className="bg-element-tertiary-contrast" />
          <Block width={stablecoinsPercentage} className="bg-element-secondary" />
          <Block width={deFiPercentage} className="bg-element-warning-soft" />
        </div>

        <div>
          <Allocation
            label="Loans"
            percentage={loansPercentage.toFixed(2)}
            value={'$' + formatBigIntToReadable(loans)}
            className="border-b border-default"
            bulletClassName="bg-element-primary-soft"
          />

          <Allocation
            label={
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
            }
            percentage={treasuryBillsPercentage.toFixed(2)}
            value={'$' + formatBigIntToReadable(treasuryBills)}
            className="border-b border-default"
            bulletClassName="bg-element-secondary"
          />

          <Allocation
            label="Stablecoins"
            percentage={stablecoinsPercentage.toFixed(2)}
            value={'$' + formatBigIntToReadable(stablecoins)}
            bulletClassName="bg-element-tertiary-contrast"
          />

          <Allocation
            label="DeFi"
            percentage={deFiPercentage.toFixed(2)}
            value={'$' + formatBigIntToReadable(deFi)}
            bulletClassName="bg-element-warning-soft"
          />
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
