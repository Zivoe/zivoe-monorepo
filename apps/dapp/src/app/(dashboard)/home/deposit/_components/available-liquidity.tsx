'use client';

import { Link } from '@zivoe/ui/core/link';
import { InfoIcon, ZapIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { EMAILS, formatBigIntWithCommas } from '@/lib/utils';

import { useAvailableLiquidity } from '../_hooks/useAvailableLiquidity';

export default function AvailableLiquidity({ type }: { type: 'desktop' | 'mobile' }) {
  const isDesktop = type === 'desktop';
  const liquidity = useAvailableLiquidity();

  if (liquidity.isPending || liquidity.data === undefined) return null;

  const hasAvailableLiquidity = liquidity.data > 0n;
  const formatted = formatBigIntWithCommas({
    value: liquidity.data,
    tokenDecimals: 6
  });

  return (
    <div className={cn(isDesktop ? 'mt-5 hidden flex-col gap-3 lg:flex' : 'flex flex-col items-end gap-1.5 lg:hidden')}>
      {/* Available liquidity */}
      {hasAvailableLiquidity && (
        <div
          className={cn(
            'rounded-md',
            isDesktop
              ? 'flex gap-3 bg-element-primary-light px-6 py-4'
              : 'flex items-center gap-2 bg-element-primary-gentle p-1.5'
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
      )}

      {/* Looking to redeem */}
      <div
        className={cn(
          'flex rounded-md bg-element-warning-light text-warning',
          isDesktop ? 'gap-3 px-6 py-4' : 'items-center gap-2 p-1.5'
        )}
      >
        <InfoIcon className={cn('flex-shrink-0', isDesktop ? 'size-6' : 'size-4')} />

        <div className={cn('flex flex-col', isDesktop && 'gap-1')}>
          {isDesktop && <p className="text-leading font-medium">Looking to redeem?</p>}

          <p className={cn('font-medium', isDesktop ? 'text-regular font-normal' : 'text-small')}>
            Contact us at{' '}
            <Link
              variant="link-neutral-dark"
              size={isDesktop ? undefined : 's'}
              className={cn(
                'text-warning-subtle underline hover:no-underline',
                isDesktop ? 'underline-offset-8' : 'underline-offset-4'
              )}
              href={`mailto:${EMAILS.INVESTORS}`}
            >
              {EMAILS.INVESTORS}
            </Link>
            {!isDesktop && ' to redeem'}
          </p>
        </div>
      </div>
    </div>
  );
}
