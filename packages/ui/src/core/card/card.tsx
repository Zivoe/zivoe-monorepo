import { type ComponentProps } from 'react';

import { cn } from '../../lib/tw-utils';

/**
 * A titled surface for a page built as a grid of sections (the portfolio).
 * Meant to sit on the soft canvas (`bg-surface-elevated`): a white card with
 * a hairline edge and a low, layered shadow lifts off it, so the header
 * needs no tint of its own and stays a plain title row over a hairline.
 * Compose: Card > CardHeader > CardTitle (+ an optional trailing control),
 * then CardContent.
 */
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border border-subtle bg-surface-base shadow-[0px_1px_2px_rgba(16,24,40,0.04),0px_4px_12px_-4px_rgba(16,24,40,0.06)]',
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-b border-subtle px-5 py-4 sm:px-6',
        className
      )}
      {...props}
    />
  );
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('flex items-center gap-2 font-heading! text-h6 text-primary', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex flex-1 flex-col p-5 sm:p-6', className)} {...props} />;
}
