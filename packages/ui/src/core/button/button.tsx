'use client';

import { type ReactNode, forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps } from 'tailwind-variants';

import { Spinner } from '../../icons';
import { tv } from '../../lib/tw-utils';

const buttonVariants = tv({
  base: [
    'font-paragraph inline-flex w-fit items-center justify-center font-medium whitespace-nowrap transition-colors',
    'disabled:bg-element-neutral disabled:text-tertiary disabled:cursor-not-allowed',
    'pending:cursor-not-allowed',
    'focus-visible:ring-default focus-visible:ring-offset-neutral-0 focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:outline-hidden',
    'focus:outline-hidden'
  ],

  variants: {
    variant: {
      primary:
        'bg-element-primary hover:bg-element-primary-subtle focus-visible:bg-element-primary-subtle pressed:bg-element-primary-soft text-base',
      secondary:
        'bg-element-secondary hover:bg-element-secondary-subtle focus-visible:bg-element-secondary-subtle pressed:bg-element-secondary-soft text-base',
      'primary-light':
        'bg-element-primary-light text-brand hover:bg-element-primary-gentle focus-visible:bg-element-primary-gentle pressed:bg-element-primary-light',
      'secondary-light':
        'bg-element-secondary-light text-brand-secondary hover:bg-element-secondary-gentle focus-visible:bg-element-secondary-gentle pressed:bg-element-secondary-light',
      border:
        'text-brand shadow-brand hover:bg-element-primary focus-visible:bg-element-primary pressed:bg-element-primary-contrast pressed:text-base bg-transparent shadow-[0_0_0_1px] hover:text-base focus-visible:text-base disabled:shadow-none',
      'border-light':
        'bg-element-base text-primary shadow-default hover:bg-element-neutral focus-visible:bg-element-neutral pressed:bg-element-neutral-light shadow-[0_0_0_1px] disabled:shadow-none',
      alert:
        'bg-element-alert hover:bg-element-alert-subtle focus-visible:bg-element-alert-subtle pressed:bg-element-alert-soft text-base',
      ghost:
        'text-primary hover:bg-element-neutral focus-visible:bg-element-neutral pressed:bg-element-neutral-light bg-transparent',
      'ghost-light':
        'text-secondary hover:bg-element-neutral focus-visible:bg-element-neutral pressed:bg-element-neutral-light bg-transparent',
      nav: 'text-primary',
      'link-base': 'text-base',
      'link-primary': 'text-brand-subtle',
      'link-secondary': 'text-brand-secondary-subtle',
      'link-neutral-dark': 'text-primary',
      'link-neutral-light': 'text-secondary',
      'link-alert': 'text-alert-subtle',
      'link-tertiary': 'text-tertiary',
      chip: 'border-default bg-element-base text-primary hover:bg-element-neutral-light focus-visible:bg-element-neutral-light pressed:bg-element-neutral border disabled:border-neutral-100'
    },

    size: {
      l: 'text-regular h-12 gap-2 rounded-sm px-4 py-3 [&_svg]:size-4',
      m: 'text-regular h-10 gap-2 rounded-sm px-3 py-2 [&_svg]:size-4',
      s: 'text-small h-8 gap-1 rounded-xs px-3 py-2 [&_svg]:size-4',
      xs: 'text-extraSmall h-6 gap-1 rounded-xs px-2 py-2.5 [&_svg]:size-3'
    },

    fullWidth: { true: 'w-full' }
  },

  compoundVariants: [
    {
      variant: [
        'link-base',
        'link-primary',
        'link-secondary',
        'link-neutral-dark',
        'link-neutral-light',
        'link-alert',
        'link-tertiary'
      ],
      className:
        'disabled:text-disabled h-auto p-0 hover:underline hover:underline-offset-8 focus-visible:ring-0 disabled:bg-transparent'
    },
    {
      variant: ['nav'],
      className:
        'current:shadow-[0_2px_0_0_rgba(0,0,0,0.1)] current:shadow-active hover:shadow-active focus-visible:shadow-active disabled:text-disabled rounded-none p-0 hover:shadow-[0_2px_0_0_rgba(0,0,0,0.1)] focus-visible:shadow-[0_2px_0_0_rgba(0,0,0,0.1)] focus-visible:ring-0 disabled:bg-transparent'
    },
    {
      variant: ['link-primary', 'link-secondary', 'link-neutral-dark', 'link-neutral-light', 'link-alert'],
      size: 'l',
      className: 'text-leading'
    },
    { variant: 'chip', className: 'gap-1 rounded-full' },
    { variant: 'chip', size: 's', className: 'h-9' },
    { variant: 'chip', size: 'xs', className: 'h-7' },
    { variant: 'ghost', className: 'current:bg-element-neutral' }
  ],

  defaultVariants: {
    variant: 'primary',
    size: 'l',
    fullWidth: false
  }
});

interface ButtonProps extends Aria.ButtonProps, VariantProps<typeof buttonVariants> {
  pendingContent?: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, isPending, pendingContent, children, ...props }: ButtonProps, ref) => {
    return (
      <Aria.Button
        isPending={isPending}
        className={composeRenderProps(className, (className) =>
          buttonVariants({ variant, size, fullWidth, className })
        )}
        {...props}
        ref={ref}
      >
        {composeRenderProps(children, (children, { isPending }) =>
          isPending ? (
            <>
              <Spinner
                role="progressbar"
                aria-label={typeof pendingContent === 'string' ? pendingContent : 'Loading'}
                className="animate-spin"
              />
              {pendingContent ?? children}
            </>
          ) : (
            children
          )
        )}
      </Aria.Button>
    );
  }
);

Button.displayName = 'ZivoeUI.Button';

export { Button, buttonVariants };
export type { ButtonProps };
