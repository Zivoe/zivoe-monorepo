'use client';

import { type ReactNode, forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps } from 'tailwind-variants';

import { Spinner } from '../../icons';
import { tv } from '../../lib/tw-utils';

const buttonVariants = tv({
  base: [
    'inline-flex w-fit items-center justify-center whitespace-nowrap font-paragraph font-medium transition-colors',
    'disabled:cursor-not-allowed disabled:bg-element-neutral disabled:text-tertiary',
    'pending:cursor-not-allowed',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-[1px] focus-visible:ring-offset-neutral-0',
    'focus:outline-none'
  ],

  variants: {
    variant: {
      primary:
        'bg-element-primary text-base hover:bg-element-primary-subtle focus-visible:bg-element-primary-subtle pressed:bg-element-primary-soft',
      secondary:
        'bg-element-secondary text-base hover:bg-element-secondary-subtle focus-visible:bg-element-secondary-subtle pressed:bg-element-secondary-soft',
      'primary-light':
        'bg-element-primary-light text-brand hover:bg-element-primary-gentle focus-visible:bg-element-primary-gentle pressed:bg-element-primary-light',
      'secondary-light':
        'bg-element-secondary-light text-brand-secondary hover:bg-element-secondary-gentle focus-visible:bg-element-secondary-gentle pressed:bg-element-secondary-light',
      border:
        'bg-transparent text-brand shadow-[0_0_0_1px] shadow-brand hover:bg-element-primary hover:text-base focus-visible:bg-element-primary focus-visible:text-base pressed:bg-element-primary-contrast pressed:text-base disabled:shadow-none',
      'border-light':
        'bg-element-base text-primary shadow-[0_0_0_1px] shadow-default hover:bg-element-neutral focus-visible:bg-element-neutral pressed:bg-element-neutral-light disabled:shadow-none',
      alert:
        'bg-element-alert text-base hover:bg-element-alert-subtle focus-visible:bg-element-alert-subtle pressed:bg-element-alert-soft',
      ghost:
        'bg-transparent text-primary hover:bg-element-neutral focus-visible:bg-element-neutral pressed:bg-element-neutral-light',
      'ghost-light':
        'bg-transparent text-secondary hover:bg-element-neutral focus-visible:bg-element-neutral pressed:bg-element-neutral-light',
      'link-primary': 'text-brand-subtle',
      'link-secondary': 'text-brand-secondary-subtle',
      'link-neutral-dark': 'text-primary',
      'link-neutral-light': 'text-secondary',
      'link-alert': 'text-alert-subtle'
    },

    size: {
      l: 'h-12 gap-2 rounded-[4px] px-4 py-3 text-regular [&_svg]:size-4',
      m: 'h-10 gap-2 rounded-[4px] px-3 py-2 text-regular [&_svg]:size-3',
      s: 'h-8 gap-1 rounded-[2px] px-3 py-2 text-small [&_svg]:size-3',
      xs: 'h-6 gap-1 rounded-[2px] px-2 py-[10px] text-extraSmall [&_svg]:size-2'
    },

    fullWidth: { true: 'w-full' }
  },

  compoundVariants: [
    {
      variant: ['link-primary', 'link-secondary', 'link-neutral-dark', 'link-neutral-light', 'link-alert'],
      className:
        'h-auto p-0 hover:underline hover:underline-offset-4 focus-visible:ring-0 disabled:bg-transparent disabled:text-disabled'
    },
    {
      variant: ['link-primary', 'link-secondary', 'link-neutral-dark', 'link-neutral-light', 'link-alert'],
      size: 'l',
      className: 'text-leading'
    }
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
        {isPending ? (
          <>
            <Spinner className="animate-spin" />
            {pendingContent}
          </>
        ) : (
          children
        )}
      </Aria.Button>
    );
  }
);

Button.displayName = 'ZivoeUI.Button';

export { Button, buttonVariants };
export type { ButtonProps };
