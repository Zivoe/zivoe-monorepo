import { ReactNode } from 'react';

import { type VariantProps } from 'tailwind-variants';

import { tv } from '../../lib/tw-utils';

export const badgeVariants = tv({
  base: 'inline-flex items-center gap-2 rounded-[4px] px-1.5 py-1 text-small font-medium [&_svg]:size-4',

  variants: {
    variant: {
      primary: 'bg-element-primary-gentle text-brand',
      secondary: 'bg-element-secondary-light text-brand-secondary',
      neutral: 'bg-element-neutral text-primary',
      warning: 'bg-element-warning-light text-warning',
      alert: 'bg-element-secondary-light text-brand-secondary'
    }
  },

  defaultVariants: {
    variant: 'primary'
  }
});

export interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: ReactNode;
  className?: string;
}

export function Badge({ children, className, variant }: BadgeProps) {
  return <div className={badgeVariants({ variant, className })}>{children}</div>;
}
