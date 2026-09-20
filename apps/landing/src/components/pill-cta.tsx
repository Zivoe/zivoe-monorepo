import { type ReactNode } from 'react';

import { ArrowRightIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

export function PillCta({
  href,
  title,
  icon,
  tone
}: {
  href: string;
  title: string;
  icon: ReactNode;
  tone: 'teal' | 'orange';
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group inline-flex w-fit shrink-0 items-center gap-3 rounded-full border border-base/50 py-3 pr-5 pl-4 text-brand backdrop-blur-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-900',
        tone === 'teal'
          ? 'bg-element-primary-gentle/75 hover:bg-element-primary-gentle/95'
          : 'bg-element-secondary-gentle/80 hover:bg-element-secondary-gentle/95'
      )}
    >
      <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center">
        {icon}
      </span>
      <span className="font-heading text-h7 tracking-[-0.04em]">{title}</span>
      <ArrowRightIcon
        aria-hidden="true"
        className="size-5 shrink-0 transition-transform motion-safe:group-hover:translate-x-1"
      />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
