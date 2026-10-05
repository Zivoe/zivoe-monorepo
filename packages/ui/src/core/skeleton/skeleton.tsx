import { cn } from '../../lib/tw-utils';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse bg-surface-elevated-emphasis motion-reduce:animate-none', className)}
      {...props}
    />
  );
}
