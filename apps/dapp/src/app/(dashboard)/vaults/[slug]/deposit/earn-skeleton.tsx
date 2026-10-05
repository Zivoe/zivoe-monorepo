import { DialogContentBox } from '@zivoe/ui/core/dialog';
import { Skeleton } from '@zivoe/ui/core/skeleton';

/**
 * The Earn box while the page's data is on its way: the desktop box beside
 * the vault info, and below `lg` the bar its actions sit in.
 */
export default function EarnSkeleton() {
  return (
    <>
      <div className="sticky top-14 hidden lg:block lg:min-w-120 xl:min-w-157.5">
        <div className="rounded-2xl bg-surface-elevated p-2">
          <div className="p-4">
            <p className="text-h6 text-primary">Earn</p>
          </div>

          <DialogContentBox>
            <Skeleton className="h-11 w-full rounded-lg" />
            <AmountFieldSkeleton />
            <AmountFieldSkeleton />
            <Skeleton className="h-12 w-full rounded-sm" />
          </DialogContentBox>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 w-full border border-t border-default bg-surface-base p-4 lg:hidden">
        <Skeleton className="h-12 w-full rounded-sm" />
      </div>
    </>
  );
}

function AmountFieldSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-3.5 w-24 rounded-sm" />
      <Skeleton className="h-24 w-full rounded-sm" />
    </div>
  );
}
