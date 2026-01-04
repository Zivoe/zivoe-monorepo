'use client';

import {
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
      cn('line-clamp-1 data-[placeholder]:text-tertiary [&>[slot=description]]:hidden', className)
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
      cn(className, isInvalid && '!shadow-[0_0_0_1px_theme(colors.alert.600),0_0_4px_1px_theme(colors.alert.600)]')
    )}
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

const SelectPopover = ({
  offset = 4,
  placement = 'bottom',
  maxHeight = 320,
  shouldFlip = true,
  className,
  ...props
}: AriaPopoverProps) => (
  <BasePopover
    offset={offset}
    placement={placement}
    maxHeight={maxHeight}
    shouldFlip={shouldFlip}
    showOverlayArrow={false}
    className={composeRenderProps(className, (className) => cn('w-[--trigger-width] max-w-none p-0', className))}
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
        'max-h-[inherit] space-y-1 overflow-auto p-2 outline-none [clipPath:inset(0_0_0_0_round_calc(var(--radius)-2px))]',
        className
      )
    )}
    {...props}
  />
);

export { Select, SelectValue, SelectTrigger, SelectItem, SelectPopover, SelectListBox };
