import { cn } from '@zivoe/ui/lib/tw-utils';

/**
 * A pulsing stand-in for a run of text, placed inside the real text element:
 * the element keeps its own line height, so the loading state takes exactly
 * the room the resolved text will. Give it a width (`w-24`).
 */
export default function TextSkeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block h-[0.8em] animate-pulse rounded-sm bg-surface-elevated-emphasis motion-reduce:animate-none',
        className
      )}
    />
  );
}
