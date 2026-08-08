import { type ReactNode } from 'react';

import { type VariantProps } from 'tailwind-variants';

import { InfoIcon, WarningIcon } from '../../icons';
import { tv } from '../../lib/tw-utils';

export const calloutVariants = tv({
  base: 'flex items-start gap-2 rounded-md p-3 text-small [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0',

  variants: {
    variant: {
      info: 'bg-element-neutral text-secondary [&_svg]:text-icon-default',
      warning: 'bg-element-warning-light text-warning [&_svg]:text-warning-subtle'
    }
  },

  defaultVariants: {
    variant: 'info'
  }
});

const CALLOUT_ICONS = {
  info: InfoIcon,
  warning: WarningIcon
};

export interface CalloutProps extends VariantProps<typeof calloutVariants> {
  children: ReactNode;
  className?: string;
  /** Drops the leading icon when the surrounding layout already carries one. */
  hideIcon?: boolean;
}

/**
 * A tinted block of standing guidance — the thing a user should know before
 * acting, which stays put rather than appearing in response to an event. For
 * transient feedback reach for `toast`, and for field-level validation use the
 * input's own `errorMessage`.
 */
export function Callout({ children, className, variant, hideIcon }: CalloutProps) {
  const Icon = CALLOUT_ICONS[variant ?? 'info'];

  return (
    <div className={calloutVariants({ variant, className })} role="note">
      {!hideIcon && <Icon />}
      <div>{children}</div>
    </div>
  );
}
