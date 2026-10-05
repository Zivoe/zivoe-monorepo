'use client';

import { Tooltip, TooltipFocusable, TooltipTrigger } from '@zivoe/ui/core/tooltip';
import { cn } from '@zivoe/ui/lib/tw-utils';

/**
 * One logo of an overlapped row, naming itself on hover and focus. A client
 * component on purpose: `TooltipFocusable` needs its child as a plain element
 * (`React.Children.only`), and one created in a Server Component can reach it
 * as a lazy reference, which fails the server render.
 */
export default function StackedLogo({
  label,
  className,
  children
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipTrigger>
      <TooltipFocusable>
        <span
          role="img"
          aria-label={label}
          className={cn(
            'relative rounded-full outline-hidden hover:z-10 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-default [&_svg]:size-5',
            className
          )}
        >
          {children}
        </span>
      </TooltipFocusable>
      <Tooltip>{label}</Tooltip>
    </TooltipTrigger>
  );
}
