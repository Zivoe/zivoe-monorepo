'use client';

import { ZapIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { NETWORK } from '@/lib/constants';
import { formatBigIntWithCommas } from '@/lib/utils';

import { useAvailableLiquidity } from '../_hooks/useAvailableLiquidity';

export default function AvailableLiquidity({ type }: { type: 'desktop' | 'mobile' }) {
  const isDesktop = type === 'desktop';
  const liquidity = useAvailableLiquidity();

  if (liquidity.isPending || liquidity.data === undefined) return null;

  const formatted = formatBigIntWithCommas({
    value: liquidity.data,
    tokenDecimals: NETWORK === 'MAINNET' ? 6 : 18
  });

  return (
    <div
      className={cn(
        'gap-3 rounded-md bg-element-primary-light',
        isDesktop ? 'mt-5 hidden px-6 py-4 lg:flex' : 'flex p-2 lg:hidden'
      )}
    >
      <ZapIcon className="size-6 flex-shrink-0 text-primary-subtle" />

      <div className="flex flex-col gap-1">
        <p className={cn('font-medium text-primary-subtle', isDesktop ? 'text-leading' : 'text-regular')}>
          Instant Liquidity{isDesktop ? ' Is Now Available' : ':'}
          {!isDesktop && <span> ${formatted}</span>}
        </p>

        {isDesktop && <p className="text-regular text-primary-subtle">Redeem up to ${formatted}</p>}
      </div>
    </div>
  );
}
