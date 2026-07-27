'use client';

import {
  ListBoxItem as AriaListBoxItem,
  type ListBoxItemProps as AriaListBoxItemProps,
  composeRenderProps
} from 'react-aria-components';

import { CheckIcon } from '../../icons';
import { tv } from '../../lib/tw-utils';

const listBoxItemVariants = tv({
  base: [
    'relative flex cursor-default items-center justify-between rounded-sm px-3 py-2.5 text-small outline-hidden transition-colors select-none',
    'disabled:pointer-events-none disabled:opacity-60',
    'focus:bg-element-neutral-light',
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
  const textValue = props.textValue ?? (typeof children === 'string' ? children : undefined);

  return (
    <AriaListBoxItem
      {...props}
      textValue={textValue}
      className={composeRenderProps(className, (className) => listBoxItemVariants({ className }))}
    >
      {composeRenderProps(children, (children, { isSelected }) => (
        <>
          <span className="flex flex-1 items-center gap-2">{children}</span>
          {showCheckmark && isSelected && <CheckIcon className="ml-2 size-4 shrink-0 text-success-contrast" />}
        </>
      ))}
    </AriaListBoxItem>
  );
};

export { ListBoxItem, type ListBoxItemProps };
