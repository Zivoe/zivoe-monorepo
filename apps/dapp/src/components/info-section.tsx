import { ReactNode } from 'react';

import { cn } from '@zivoe/ui/lib/tw-utils';

export default function InfoSection({
  title,
  icon,
  children,
  className
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      <div className="flex items-center gap-2">
        <InfoSectionIcon>{icon}</InfoSectionIcon>

        <p className="text-h7 text-primary">{title}</p>
      </div>

      {children}
    </div>
  );
}

export function InfoSectionIcon({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-fit items-center justify-center rounded-[4px] bg-element-primary-gentle p-[5px] [&_svg]:size-4 [&_svg]:text-brand">
      {children}
    </div>
  );
}
