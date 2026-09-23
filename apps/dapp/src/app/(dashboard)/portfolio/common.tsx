import { type ReactNode } from 'react';

import { formatUnits } from 'viem';

import { cn } from '@zivoe/ui/lib/tw-utils';

export const money = (value: bigint | null) =>
  value === null
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(
        Number(formatUnits(value, 18))
      );
export const amount = (value: bigint, decimals = 18) =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(Number(formatUnits(value, decimals)));
export const vaultLink = (view: 'deposit' | 'redeem' | 'pending') => `/vaults/zivoe-smb-credit?view=${view}`;
export const dateLabel = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
export function Card({
  title,
  titleIcon,
  children,
  className,
  extra
}: {
  title: string;
  titleIcon?: ReactNode;
  children: ReactNode;
  className?: string;
  extra?: ReactNode;
}) {
  return (
    <section className={cn('min-w-0 rounded-2xl border border-default bg-surface-base', className)} aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-default bg-element-primary-light px-5 py-3 sm:px-6">
        <h2 className="flex items-center gap-2 font-heading! text-h6 text-primary">
          {titleIcon}
          {title}
        </h2>
        {extra}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}
