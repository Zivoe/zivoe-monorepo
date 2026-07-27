'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps } from 'tailwind-variants';

import { cn, tv } from '../../lib/tw-utils';

const switchVariants = tv({
  slots: {
    container: [
      'peer bg-surface-elevated-low-emphasis inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-none transition-colors',
      'group-data-focus-visible:ring-default group-data-focus-visible:ring-offset-neutral-0 group-data-focus-visible:ring-2 group-data-focus-visible:ring-offset-1',
      'group-data-disabled:bg-surface-elevated-contrast group-data-disabled:cursor-not-allowed',
      'group-selected:bg-element-primary-subtle group-data-disabled:group-selected:bg-element-primary',
      'group-data-readonly:cursor-auto',
      /* Resets */
      'group-data-focus-visible:outline-hidden'
    ],

    thumb:
      'bg-surface-base group-data-disabled:bg-surface-elevated-high-contrast group-data-disabled:group-selected:bg-element-primary-contrast pointer-events-none block size-5 translate-x-1 rounded-full shadow-lg ring-0 transition-transform group-selected:translate-x-6'
  }
});

interface SwitchProps extends Aria.SwitchProps, VariantProps<typeof switchVariants> {}

const Switch = forwardRef<HTMLLabelElement, SwitchProps>(({ children, className, ...props }, ref) => {
  const { container, thumb } = switchVariants();

  return (
    <Aria.Switch
      className={composeRenderProps(className, (className) =>
        cn(
          'group text-regular text-primary inline-flex items-center gap-2 leading-none font-medium data-disabled:cursor-not-allowed',
          className
        )
      )}
      {...props}
      ref={ref}
    >
      {composeRenderProps(children, (children) => (
        <>
          <div className={container()}>
            <div className={thumb()} />
          </div>
          {children}
        </>
      ))}
    </Aria.Switch>
  );
});

Switch.displayName = 'ZivoeUI.Switch';

export { Switch, switchVariants };
