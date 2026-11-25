import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRowHeader
} from '@zivoe/ui/core/table';
import { cn } from '@zivoe/ui/lib/tw-utils';

// A typical team's worth of rows; the loaded list may be shorter or longer.
const ROWS = [0, 1, 2];

/**
 * Members while the organization loads: the page's own frame (heading, card, table on a wide
 * card and list on a narrow one), with placeholders sized like what replaces them.
 */
export default function MembersLoading() {
  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 flex-col gap-1">
          <CardTitle>Members</CardTitle>
          <Line className="text-small" width="w-32" />
        </div>
        <Skeleton className="h-10 w-33 rounded-sm" />
      </CardHeader>

      <CardContent aria-hidden="true" className="gap-6">
        <div className="@container">
          <div className="hidden w-full @2xl:block">
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeaderCell className="pl-0">Member</TableHeaderCell>
                  <TableHeaderCell>Status</TableHeaderCell>
                  <TableHeaderCell className="pr-0" />
                </TableRow>
              </TableHead>
              <TableBody>
                {ROWS.map((row) => (
                  <TableRow key={row}>
                    <TableRowHeader className="pl-0">
                      <PersonSkeleton />
                    </TableRowHeader>
                    <TableCell>
                      <Skeleton className="h-7 w-16 rounded-sm" />
                    </TableCell>
                    <TableCell className="pr-0 text-right">
                      {/* The ⋯ button's footprint, so the row is as tall as a loaded one. */}
                      <span className="inline-block h-8 w-10.5 align-middle" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="flex flex-col divide-y divide-subtle @2xl:hidden">
            {ROWS.map((row) => (
              <li key={row} className="flex flex-col gap-2 py-3">
                <PersonSkeleton />
                <Skeleton className="h-7 w-16 rounded-sm" />
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

/** A placeholder one line of text tall, in whatever text size `className` sets. */
function Line({ className, width }: { className?: string; width: string }) {
  return (
    <span className={cn('flex h-[1lh] items-center', className)}>
      <Skeleton className={cn('h-3 rounded-xs', width)} />
    </span>
  );
}

function PersonSkeleton() {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Skeleton className="size-9 shrink-0 rounded-sm" />
      <span className="flex min-w-0 flex-col">
        <Line width="w-28" />
        <Line className="text-small" width="w-40" />
      </span>
    </span>
  );
}
