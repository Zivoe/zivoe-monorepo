'use client';

import { ZapIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { formatBigIntWithCommas } from '@/lib/utils';

import { useAvailableLiquidity } from '../_hooks/useAvailableLiquidity';

export default function AvailableLiquidity({ type }: { type: 'desktop' | 'mobile' }) {
  const isDesktop = type === 'desktop';
  const liquidity = useAvailableLiquidity();

  if (liquidity.isPending || liquidity.data === undefined) return null;

  const formatted = formatBigIntWithCommas({
    value: liquidity.data,
    tokenDecimals: 6
  });

  return (
    <div
      className={cn(
        'rounded-md',
        isDesktop
          ? 'mt-5 hidden gap-3 bg-element-primary-light px-6 py-4 lg:flex'
          : 'flex items-center gap-2 bg-element-primary-gentle p-1.5 lg:hidden'
      )}
    >
      <ZapIcon className={cn('flex-shrink-0', isDesktop ? 'size-6 text-primary-subtle' : 'size-4 text-brand')} />

      <div className="flex flex-col gap-1">
        <p className={cn('font-medium', isDesktop ? 'text-leading text-primary-subtle' : 'text-small text-brand')}>
          Instant Liquidity{isDesktop ? ' Is Now Available' : ':'}
          {!isDesktop && <span> ${formatted}</span>}
        </p>

        {isDesktop && <p className="text-regular text-primary-subtle">Redeem up to ${formatted}</p>}
      </div>
    </div>
  );
}
