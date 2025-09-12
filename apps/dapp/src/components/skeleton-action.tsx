import { cn } from '@zivoe/ui/lib/tw-utils';

export default function SkeletonAction({
  title,
  description,
  children,
  className
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('absolute inset-0 flex items-center justify-center', className)}>
      <div className="flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h3 className="text-h7 text-primary">{title}</h3>
          <p className="text-regular text-secondary">{description}</p>
        </div>

        {children}
      </div>
    </div>
  );
}
