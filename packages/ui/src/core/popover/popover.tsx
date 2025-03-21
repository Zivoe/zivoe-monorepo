'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { VariantProps, tv } from 'tailwind-variants';

import { OverlayArrow } from '../common/overlay-arrow';

const PopoverTrigger = Aria.DialogTrigger;

const popoverVariants = tv({
  base: [
    'z-50 max-w-xs rounded-md border border-default bg-element-base p-2 text-small text-secondary shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.05),0px_4px_6px_-2px_rgba(16,24,40,0.03)]',
    /* Entering */
    'entering:animate-in entering:fade-in-0 entering:zoom-in-90',
    /* Exiting */
    'exiting:animate-out exiting:fade-out-0 exiting:zoom-out-90',
    /* Placement */
    'placement-left:slide-in-from-right-2 placement-right:slide-in-from-left-2 placement-top:slide-in-from-bottom-2 placement-bottom:slide-in-from-top-2'
  ]
});

interface BasePopoverProps extends Aria.PopoverProps, VariantProps<typeof popoverVariants> {
  showOverlayArrow?: boolean;
}

const BasePopover = forwardRef<HTMLDivElement, BasePopoverProps>(
  ({ className, offset = 4, children, placement = 'bottom', showOverlayArrow = false, ...props }, ref) => (
    <Aria.Popover
      ref={ref}
      offset={offset}
      placement={placement}
      className={composeRenderProps(className, (className) => popoverVariants({ className }))}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>
          {showOverlayArrow && <OverlayArrow placement={placement} />}
          {children}
        </>
      ))}
    </Aria.Popover>
  )
);

const Popover = forwardRef<HTMLDivElement, BasePopoverProps>(({ children, ...props }, ref) => (
  <BasePopover {...props} ref={ref}>
    {composeRenderProps(children, (children) => (
      <Aria.Dialog className="outline-none">{children}</Aria.Dialog>
    ))}
  </BasePopover>
));

BasePopover.displayName = 'ZivoeUI.BasePopover';
Popover.displayName = 'ZivoeUI.Popover';

export { PopoverTrigger, BasePopover, Popover, popoverVariants };
