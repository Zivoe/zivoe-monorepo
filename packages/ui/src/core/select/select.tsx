'use client';

import {
  ButtonProps as AriaButtonProps,
  ListBox as AriaListBox,
  ListBoxProps as AriaListBoxProps,
  PopoverProps as AriaPopoverProps,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
  SelectValueProps as AriaSelectValueProps,
  composeRenderProps
} from 'react-aria-components';

import { ChevronDownIcon } from '../../icons';
import { cn } from '../../lib/tw-utils';
import { Button, ButtonProps } from '../button';
import { ListBoxItem } from '../list-box';
import { BasePopover } from '../popover';

const Select = AriaSelect;

const SelectItem = ListBoxItem;

const SelectValue = <T extends object>({ className, ...props }: AriaSelectValueProps<T>) => (
  <AriaSelectValue
    className={composeRenderProps(className, (className) =>
      cn('line-clamp-1 data-[placeholder]:text-primary [&>[slot=description]]:hidden', className)
    )}
    {...props}
  />
);

const SelectTrigger = ({ variant = 'chip', size = 's', className, children, ...props }: ButtonProps) => (
  <Button
    variant={variant}
    size={size}
    className={composeRenderProps(className, (className) => cn(className))}
    {...props}
  >
    {composeRenderProps(children, (children) => (
      <>
        {children}
        <ChevronDownIcon aria-hidden="true" className="size-4 text-icon-default" />
      </>
    ))}
  </Button>
);

const SelectPopover = ({ offset = 4, placement = 'bottom', className, ...props }: AriaPopoverProps) => (
  <BasePopover
    offset={offset}
    placement={placement}
    showOverlayArrow={false}
    className={composeRenderProps(className, (className) => cn('p-0', className))}
    {...props}
  />
);

const SelectListBox = <T extends object>({
  className,
  scrollAreaClassName,
  ...props
}: AriaListBoxProps<T> & { scrollAreaClassName?: string }) => (
  <AriaListBox
    className={composeRenderProps(className, (className) =>
      cn(
        'max-h-[inherit] space-y-1 overflow-auto p-2 outline-none [clip-path:inset(0_0_0_0_round_calc(var(--radius)-2px))]',
        className
      )
    )}
    {...props}
  />
);

export { Select, SelectValue, SelectTrigger, SelectItem, SelectPopover, SelectListBox };
