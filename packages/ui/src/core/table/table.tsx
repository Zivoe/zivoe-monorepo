import { type ComponentProps, forwardRef } from 'react';

import { cn } from '../../lib/tw-utils';

/**
 * The look of a data table, on plain HTML: nothing here sorts, filters or holds
 * state. The wrapper scrolls on its own and, being focusable and named, can be
 * scrolled from the keyboard. Name it with `aria-label`.
 */
const TableContainer = forwardRef<HTMLDivElement, ComponentProps<'div'> & { 'aria-label': string }>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      role="region"
      tabIndex={0}
      className={cn(
        // `relative`: visually hidden headers are positioned against it, not the page, so a table wider than
        // its box scrolls inside it and never widens the page.
        'relative w-full overflow-x-auto rounded-sm',
        'focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2 focus-visible:outline-hidden',
        className
      )}
      {...props}
    />
  )
);

function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full border-collapse text-left text-small', className)} {...props} />;
}

function TableHead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('border-b border-subtle', className)} {...props} />;
}

function TableBody({ className, ...props }: ComponentProps<'tbody'>) {
  return <tbody className={cn('[&>tr]:border-subtle [&>tr:not(:last-child)]:border-b', className)} {...props} />;
}

function TableRow({ className, ...props }: ComponentProps<'tr'>) {
  return <tr className={className} {...props} />;
}

function TableHeaderCell({ className, ...props }: ComponentProps<'th'>) {
  return <th scope="col" className={cn('px-4 py-3 font-medium text-secondary', className)} {...props} />;
}

function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('px-4 py-3 align-middle text-primary', className)} {...props} />;
}

/** A row's naming cell: what a screen reader announces the other cells against. */
function TableRowHeader({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th scope="row" className={cn('px-4 py-3 text-left align-middle font-normal text-primary', className)} {...props} />
  );
}

TableContainer.displayName = 'ZivoeUI.TableContainer';

export { TableContainer, Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell, TableRowHeader };
