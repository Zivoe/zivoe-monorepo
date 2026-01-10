import { ReactNode } from 'react';

import { cn } from '@zivoe/ui/lib/tw-utils';

import { InfoSectionIcon } from '@/components/info-section';

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex w-full flex-col gap-6 rounded-2xl bg-surface-elevated px-4 py-6', className)}>
      {children}
    </div>
  );
}

function CardHeader({
  title,
  titleSmall,
  icon,
  children,
  className
}: {
  title: string;
  titleSmall?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-10 px-2', className)}>
      <div className="flex items-center gap-2">
        {icon && <InfoSectionIcon>{icon}</InfoSectionIcon>}

        <>
          <h2 className={cn('text-h7 text-primary sm:hidden', !titleSmall && 'hidden')}>{titleSmall}</h2>
          <h2 className={cn('text-h7 text-primary', titleSmall && 'hidden sm:block')}>{title}</h2>
        </>
      </div>

      {children && <div className="flex items-center gap-3">{children}</div>}
    </div>
  );
}

function CardBody({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl bg-surface-base p-6 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]',
        className
      )}
    >
      {children}
    </div>
  );
}

Card.Header = CardHeader;
Card.Body = CardBody;

export { Card };
