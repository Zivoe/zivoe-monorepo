'use client';

import {
  ListBoxItem as AriaListBoxItem,
  ListBoxItemProps as AriaListBoxItemProps,
  composeRenderProps
} from 'react-aria-components';

import { tv } from '../../lib/tw-utils';

const listBoxItemVariants = tv({
  base: [
    'relative flex cursor-default select-none items-center rounded-[4px] px-3 py-[10px] text-small outline-none transition-colors',
    /* Disabled */
    'disabled:pointer-events-none disabled:opacity-60',
    /* Focused */
    'focus:bg-element-neutral-light',
    /* Hovered */
    'hover:cursor-pointer hover:bg-element-neutral-light'
  ]
});

const ListBoxItem = <T extends object>({ className, children, ...props }: AriaListBoxItemProps<T>) => {
  return (
    <AriaListBoxItem
      textValue={props.textValue || (typeof children === 'string' ? children : undefined)}
      className={composeRenderProps(className, (className) => listBoxItemVariants({ className }))}
      {...props}
    >
      {composeRenderProps(children, (children) => (
        <>{children}</>
      ))}
    </AriaListBoxItem>
  );
};

export { ListBoxItem };
