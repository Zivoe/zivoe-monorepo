'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { VariantProps } from 'tailwind-variants';

import { cn, tv } from '../../lib/tw-utils';

const switchVariants = tv({
  slots: {
    container: [
      'peer inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-none bg-surface-elevated-low-emphasis transition-colors',
      /* Focus Visible */
      'group-data-[focus-visible]:ring-2 group-data-[focus-visible]:ring-default group-data-[focus-visible]:ring-offset-[1px] group-data-[focus-visible]:ring-offset-neutral-0',
      /* Disabled */
      'group-data-[disabled]:cursor-not-allowed group-data-[disabled]:bg-surface-elevated-contrast',
      /* Selected */
      'group-data-[selected]:bg-element-primary-subtle group-data-[selected]:group-data-[disabled]:bg-element-primary',
      /* Readonly */
      'group-data-[readonly]:cursor-auto',
      /* Resets */
      'group-data-[focus-visible]:outline-none'
    ],

    thumb:
      'pointer-events-none block size-5 translate-x-1 rounded-full bg-surface-base shadow-lg ring-0 transition-transform group-data-[selected]:translate-x-6 group-data-[disabled]:bg-surface-elevated-high-contrast group-data-[selected]:group-data-[disabled]:bg-element-primary-contrast'
  }
});

interface SwitchProps extends Aria.SwitchProps, VariantProps<typeof switchVariants> {}

const Switch = forwardRef<HTMLLabelElement, SwitchProps>(({ children, className, ...props }, ref) => {
  const { container, thumb } = switchVariants();

  return (
    <Aria.Switch
      className={composeRenderProps(className, (className) =>
        cn(
          'group inline-flex items-center gap-2 text-regular font-medium leading-none text-primary data-[disabled]:cursor-not-allowed',
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
