'use client';

import { Disclosure, DisclosureGroup, DisclosureHeader, DisclosurePanel } from '@zivoe/ui/core/disclosure';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { DisclosureArrowIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { CurrentDailyData } from '@/server/data';

import { formatBigIntToReadable } from '@/lib/utils';

const CATEGORIES = [
  { key: 'stablecoins', name: 'Stablecoins', color: 'bg-primary-800' },
  { key: 'treasuryBills', name: 'Treasury Bills', color: 'bg-primary-600' },
  { key: 'deFi', name: 'DeFi Positions', color: 'bg-primary-400' },
  { key: 'loans', name: 'Loans', color: 'bg-primary-500' }
] as const;

function PanelItem({ label, value }: { label: string; value: bigint }) {
  return (
    <div className="mr-4 flex h-10 items-center justify-between">
      <div className="flex items-center gap-2">
        <DisclosureArrowIcon className="size-5 text-icon-default" />
        <span className="text-regular text-secondary">{label}</span>
      </div>

      <span className="text-regular text-secondary">${formatBigIntToReadable(value, 18)}</span>
    </div>
  );
}

export default function AUMAccordion({ data }: { data: CurrentDailyData['tvl'] }) {
  const sortedCategories = [...CATEGORIES].sort((a, b) => data[b.key].percentage - data[a.key].percentage);

  return (
    <DisclosureGroup className="w-full">
      {sortedCategories.map((category) => (
        <Disclosure key={category.key} className="group border-b-0 py-0">
          <DisclosureHeader className="rounded-md px-3 py-4 transition-colors hover:bg-element-neutral-light">
            <div className="mr-4 flex w-full items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('size-2 rounded-full', category.color)} />
                <span className="text-regular text-primary sm:text-leading">{category.name}</span>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-regular text-primary sm:text-leading">
                  ${formatBigIntToReadable(data[category.key].total, 18)}
                </span>
              </div>
            </div>
          </DisclosureHeader>

          <DisclosurePanel className="px-8">
            {category.key === 'stablecoins' && (
              <>
                {data.stablecoins.usdc > 0n && <PanelItem label="USDC" value={data.stablecoins.usdc} />}
                {data.stablecoins.usdt > 0n && <PanelItem label="USDT" value={data.stablecoins.usdt} />}
                {data.stablecoins.frxUSD > 0n && <PanelItem label="frxUSD" value={data.stablecoins.frxUSD} />}
              </>
            )}
            {category.key === 'treasuryBills' && (
              <>{data.treasuryBills.m0 > 0n && <PanelItem label="$wM by M0" value={data.treasuryBills.m0} />}</>
            )}
            {category.key === 'deFi' && (
              <>{data.deFi.aUSDC > 0n && <PanelItem label="aUSDC" value={data.deFi.aUSDC} />}</>
            )}
            {category.key === 'loans' && (
              <>
                <PanelItem label="Zinclusive" value={data.loans.zinclusive} />
                <PanelItem label="NewCo Capital Group" value={data.loans.newCo} />
              </>
            )}
          </DisclosurePanel>
        </Disclosure>
      ))}
    </DisclosureGroup>
  );
}

export function AUMAccordionSkeleton() {
  return (
    <div className="w-full">
      {[1, 2, 3, 4].map((index) => (
        <div key={index} className="flex h-14 items-center">
          <div className="flex w-full items-center justify-between px-3 py-4">
            <div className="flex items-center gap-2">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-6 w-32 rounded-md" />
            </div>

            <Skeleton className="h-6 w-24 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
