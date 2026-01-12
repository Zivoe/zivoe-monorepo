'use client';

import {
  ListBoxItem as AriaListBoxItem,
  ListBoxItemProps as AriaListBoxItemProps,
  composeRenderProps
} from 'react-aria-components';

import { CheckIcon } from '../../icons';
import { tv } from '../../lib/tw-utils';

const listBoxItemVariants = tv({
  base: [
    'relative flex cursor-default select-none items-center justify-between rounded-[4px] px-3 py-[10px] text-small outline-none transition-colors',
    /* Disabled */
    'disabled:pointer-events-none disabled:opacity-60',
    /* Focused */
    'focus:bg-element-neutral-light',
    /* Hovered */
    'hover:cursor-pointer hover:bg-element-neutral-light'
  ]
});

interface ListBoxItemProps<T extends object> extends AriaListBoxItemProps<T> {
  showCheckmark?: boolean;
}

const ListBoxItem = <T extends object>({
  className,
  children,
  showCheckmark = true,
  ...props
}: ListBoxItemProps<T>) => {
  return (
    <AriaListBoxItem
      textValue={props.textValue || (typeof children === 'string' ? children : undefined)}
      className={composeRenderProps(className, (className) => listBoxItemVariants({ className }))}
      {...props}
    >
      {composeRenderProps(children, (children, { isSelected }) => (
        <>
          <span className="flex flex-1 items-center gap-2">{children}</span>
          {showCheckmark && isSelected && <CheckIcon className="text-success-600 ml-2 size-4 shrink-0" />}
        </>
      ))}
    </AriaListBoxItem>
  );
};

export { ListBoxItem, type ListBoxItemProps };
