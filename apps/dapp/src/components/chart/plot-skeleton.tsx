import { Skeleton } from '@zivoe/ui/core/skeleton';

/**
 * The silhouette of an area chart while its data is on its way: gridlines
 * with their labels, a row of day labels, and a soft, pulsing area with a
 * gently rising top edge — the same grey as every other skeleton block,
 * shaped like a chart. Sized like `ChartContainer` (16:9, a 60px value axis
 * that the charts hide below `sm`, where the plot runs edge to edge) so the
 * real plot lands in its place without a jump.
 */
export function ChartPlotSkeleton() {
  return (
    <div aria-hidden="true" className="flex aspect-video w-full flex-col gap-2 pt-2.5">
      <div className="relative flex flex-1 flex-col justify-between">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-4">
            <Skeleton className="hidden h-3 w-12 shrink-0 rounded-sm sm:block" />
            <div className="h-px flex-1 bg-neutral-200" />
          </div>
        ))}
        {/* Stretched to the plot. */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-y-1.5 right-0 left-0 h-[calc(100%-0.75rem)] w-full animate-pulse motion-reduce:animate-none sm:left-16 sm:w-[calc(100%-4rem)]"
        >
          {/* The skeleton grey, like the pulsing blocks around it. */}
          <path d={`${MOCK_AREA_PATH} V100 H0 Z`} fill="hsl(var(--neutral-200))" />
        </svg>
      </div>
      <div className="flex justify-between sm:pl-16">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-3 w-10 rounded-sm" />
        ))}
      </div>
    </div>
  );
}

const MOCK_AREA_PATH = 'M0 78 C 8 76, 14 68, 22 70 S 36 62, 44 56 S 56 50, 64 42 S 80 36, 88 28 S 96 24, 100 22';
