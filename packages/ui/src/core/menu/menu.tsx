'use client';

import React from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';

import { usePrefetch } from '../../hooks/usePrefetch';
import { CaretRightIcon } from '../../icons';
import { fixedForwardRef } from '../../lib';
import { type VariantProps, cn, tv } from '../../lib/tw-utils';
import { Button, type ButtonProps } from '../button';
import { BasePopover } from '../popover';
import { ScrollArea, ScrollBar } from '../scroll-area';

const MenuTrigger = Aria.MenuTrigger;

const MenuSubTrigger = Aria.SubmenuTrigger;

const MenuSection = Aria.MenuSection;

const MenuCollection = Aria.Collection;

const MenuPopover = ({ offset = 4, placement = 'bottom', className, ...props }: Aria.PopoverProps) => (
  <BasePopover
    offset={offset}
    placement={placement}
    showOverlayArrow={false}
    className={composeRenderProps(className, (className) => cn('p-2', className))}
    {...props}
  />
);

type MenuProps<T> = Aria.MenuProps<T> & {
  scrollAreaClassName?: string;
};

const Menu = fixedForwardRef(MenuComponent);
function MenuComponent<T extends { id: string; label: string }>(
  { className, items, scrollAreaClassName, ...props }: MenuProps<T> & { className?: string },
  ref: React.ForwardedRef<HTMLDivElement>
) {
  return (
    <div className={className}>
      <ScrollArea className={cn('-m-2', scrollAreaClassName)}>
        <Aria.Menu className="space-y-1 p-2 outline-hidden" ref={ref} items={items} {...props} />
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}

const menuItemVariants = tv({
  base: [
    'text-small relative flex cursor-default items-center rounded-sm px-3 py-2.5 outline-hidden transition-colors select-none',
    /* Disabled */
    'disabled:pointer-events-none disabled:opacity-60',
    /* Focused */
    'focus:bg-element-neutral-light',
    /* Hovered */
    'hover:bg-element-neutral-light hover:cursor-pointer'
  ],

  variants: {
    isSelected: {
      true: 'bg-element-neutral-light'
    }
  }
});

type MenuItemProps = Aria.MenuItemProps &
  Omit<VariantProps<typeof menuItemVariants>, 'isSelected'> & { prefetch?: boolean };

const MenuItem = ({
  children,
  className,
  target = '_self',
  rel: providedRel,
  prefetch = true,
  ...props
}: MenuItemProps) => {
  usePrefetch({ href: props.href, target, enabled: prefetch });
  const rel = target === '_blank' ? (providedRel ?? 'noopener noreferrer') : providedRel;
  const textValue = props.textValue ?? (typeof children === 'string' ? children : undefined);

  return (
    <Aria.MenuItem
      {...props}
      target={target}
      rel={rel}
      textValue={textValue}
      className={composeRenderProps(className, (className, { isSelected }) =>
        menuItemVariants({ className, isSelected })
      )}
    >
      {composeRenderProps(children, (children, { hasSubmenu }) => (
        <>
          {children}
          {hasSubmenu && <CaretRightIcon className="ml-auto size-4" />}
        </>
      ))}
    </Aria.MenuItem>
  );
};

const MenuSeparator = ({ className, ...props }: Aria.SeparatorProps) => (
  <Aria.Separator className={cn('bg-element-neutral-light my-1 h-px', className)} {...props} />
);

const MenuButton = ({ className, isCurrent: _isCurrent, ...props }: ButtonProps & { isCurrent?: boolean }) => {
  return <Button className={composeRenderProps(className, (className) => cn(className))} {...props} />;
};

MenuPopover.displayName = 'ZivoeUI.MenuPopover';
MenuComponent.displayName = 'ZivoeUI.Menu';
MenuItem.displayName = 'ZivoeUI.MenuItem';
MenuSeparator.displayName = 'ZivoeUI.MenuSeparator';
MenuButton.displayName = 'ZivoeUI.MenuButton';

export {
  MenuTrigger,
  MenuSubTrigger,
  MenuSection,
  MenuCollection,
  MenuPopover,
  Menu,
  MenuItem,
  MenuSeparator,
  MenuButton
};
