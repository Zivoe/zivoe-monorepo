'use client';

import {
  ListBox as AriaListBox,
  type ListBoxProps as AriaListBoxProps,
  type PopoverProps as AriaPopoverProps,
  Select as AriaSelect,
  SelectValue as AriaSelectValue,
  type SelectValueProps as AriaSelectValueProps,
  composeRenderProps
} from 'react-aria-components';

import { ChevronDownIcon } from '../../icons';
import { cn } from '../../lib/tw-utils';
import { Button, type ButtonProps } from '../button';
import { ListBoxItem } from '../list-box';
import { BasePopover } from '../popover';

const Select = AriaSelect;

const SelectItem = ListBoxItem;

const SelectValue = <T extends object>({ className, ...props }: AriaSelectValueProps<T>) => (
  <AriaSelectValue
    className={composeRenderProps(className, (className) =>
      cn('data-placeholder:text-tertiary line-clamp-1 *:[[slot=description]]:hidden', className)
    )}
    {...props}
  />
);

interface SelectTriggerProps extends ButtonProps {
  isInvalid?: boolean;
}

const SelectTrigger = ({
  variant = 'chip',
  size = 's',
  className,
  children,
  isInvalid,
  ...props
}: SelectTriggerProps) => (
  <Button
    variant={variant}
    size={size}
    className={composeRenderProps(className, (className) =>
      cn(className, isInvalid && 'shadow-[0_0_0_1px_var(--color-alert-600),0_0_4px_1px_var(--color-alert-600)]!')
    )}
    {...props}
  >
    {composeRenderProps(children, (children) => (
      <>
        {children}
        <ChevronDownIcon aria-hidden="true" className="text-icon-default size-4" />
      </>
    ))}
  </Button>
);

interface SelectPopoverProps extends AriaPopoverProps {
  matchTriggerWidth?: boolean;
}

const SelectPopover = ({
  offset = 4,
  placement = 'bottom',
  maxHeight,
  shouldFlip = true,
  matchTriggerWidth = false,
  className,
  ...props
}: SelectPopoverProps) => (
  <BasePopover
    offset={offset}
    placement={placement}
    maxHeight={maxHeight}
    shouldFlip={shouldFlip}
    showOverlayArrow={false}
    className={composeRenderProps(className, (className) =>
      cn('border-0 bg-transparent p-0 shadow-none', matchTriggerWidth && 'w-(--trigger-width) max-w-none', className)
    )}
    {...props}
  />
);

const SelectListBox = <T extends object>({
  className,
  scrollAreaClassName: _scrollAreaClassName,
  ...props
}: AriaListBoxProps<T> & { scrollAreaClassName?: string }) => (
  <AriaListBox
    className={composeRenderProps(className, (className) =>
      cn(
        'border-default bg-element-base max-h-[inherit] min-h-32 space-y-1 overflow-auto rounded-md border p-2 shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.05),0px_4px_6px_-2px_rgba(16,24,40,0.03)] outline-hidden md:max-h-80',
        className
      )
    )}
    {...props}
  />
);

export { Select, SelectValue, SelectTrigger, SelectItem, SelectPopover, SelectListBox };
