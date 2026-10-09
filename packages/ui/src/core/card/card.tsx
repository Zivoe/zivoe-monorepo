import { type ComponentProps } from 'react';

import { cn } from '../../lib/tw-utils';

/**
 * A titled surface for a page built as a grid of sections (the portfolio).
 * The header strip is tinted so the sections read apart on the base surface;
 * the body is the plain card. Compose: Card > CardHeader > CardTitle (+ an
 * optional trailing control), then CardContent.
 */
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-2xl border border-default bg-surface-base shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]',
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
        'flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-b border-default bg-element-primary-light px-5 py-3 sm:px-6',
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
