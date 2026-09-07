'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps, tv } from 'tailwind-variants';

import { OverlayArrow } from '../common/overlay-arrow';

/**
 * Opens its Tooltip while the first child is hovered or keyboard-focused —
 * never on tap, so touch users rely on the trigger's own accessible name.
 * Interactive children (Button, Link) work as-is; wrap a plain element in
 * TooltipFocusable to make it a trigger.
 */
function TooltipTrigger({ delay = 250, ...props }: Aria.TooltipTriggerComponentProps) {
  return <Aria.TooltipTrigger delay={delay} {...props} />;
}

/** Makes a non-interactive element (a span around an icon) a valid TooltipTrigger child. */
const TooltipFocusable: typeof Aria.Focusable = Aria.Focusable;

const tooltipVariants = tv({
  base: [
    'z-50 max-w-xs rounded-md border border-default bg-element-base px-2.5 py-1.5 text-small text-primary shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.05),0px_4px_6px_-2px_rgba(16,24,40,0.03)]',
    'entering:animate-in entering:fade-in-0 entering:zoom-in-90',
    'exiting:animate-out exiting:fade-out-0 exiting:zoom-out-90',
    'placement-left:slide-in-from-right-1 placement-right:slide-in-from-left-1 placement-top:slide-in-from-bottom-1 placement-bottom:slide-in-from-top-1'
  ]
});

interface TooltipProps extends Aria.TooltipProps, VariantProps<typeof tooltipVariants> {
  showOverlayArrow?: boolean;
}

const Tooltip = forwardRef<HTMLDivElement, TooltipProps>(
  ({ className, offset = 6, children, placement = 'top', showOverlayArrow = false, ...props }, ref) => (
    <Aria.Tooltip
      ref={ref}
      offset={offset}
      placement={placement}
      className={composeRenderProps(className, (className) => tooltipVariants({ className }))}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>
          {showOverlayArrow && <OverlayArrow placement={placement} />}
          {children}
        </>
      ))}
    </Aria.Tooltip>
  )
);

TooltipTrigger.displayName = 'ZivoeUI.TooltipTrigger';
Tooltip.displayName = 'ZivoeUI.Tooltip';

export { TooltipTrigger, TooltipFocusable, Tooltip, tooltipVariants };
export type { TooltipProps };
