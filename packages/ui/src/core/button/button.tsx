'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps } from 'tailwind-variants';

import { tv } from '../../lib/tw-utils';

const buttonVariants = tv({
  base: ['inline-flex w-fit items-center justify-center text-white whitespace-nowrap'],

  variants: {
    variant: {
      primary: 'bg-blue-500 hover:bg-blue-900',
      secondary: 'bg-purple-500 hover:bg-purple-900'
    },

    size: {
      md: 'h-7 gap-1 rounded-2 px-3 py-2',
      lg: 'h-12 gap-2 rounded-4 px-5 py-4'
    },

    fullWidth: { true: 'w-full' }
  },

  defaultVariants: {
    variant: 'primary',
    size: 'md',
    fullWidth: false
  }
});

interface ButtonProps extends Aria.ButtonProps, VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, fullWidth, children, ...props }: ButtonProps, ref) => {
    return (
      <Aria.Button
        className={composeRenderProps(className, (className) =>
          buttonVariants({ variant, size, fullWidth, className })
        )}
        {...props}
        ref={ref}
      >
        {children}
      </Aria.Button>
    );
  }
);

Button.displayName = 'ZivoeUI.Button';

export { Button, buttonVariants };
export type { ButtonProps };
