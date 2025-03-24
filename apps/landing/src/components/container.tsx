import { ReactNode } from 'react';

import { cn } from '@zivoe/ui/lib/tw-utils';

export default function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto flex w-full flex-1 flex-col items-start justify-start px-4', className)}>
      {children}
    </div>
  );
}
