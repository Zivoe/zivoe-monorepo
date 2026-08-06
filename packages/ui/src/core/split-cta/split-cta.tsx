'use client';

import { type ReactNode, forwardRef } from 'react';

import { composeRenderProps } from 'react-aria-components';

import { ArrowRightIcon } from '../../icons';
import { tv } from '../../lib/tw-utils';
import { Link, type LinkProps } from '../link';

/**
 * Horizontal padding for the label panel, mirroring the padding `buttonVariants` applies to a
 * regular button at each size. The `satisfies` check fails to compile if the button size scale
 * gains a size this component hasn't accounted for.
 */
const LABEL_PADDING = {
  l: { label: 'px-4' },
  m: { label: 'px-3' },
  s: { label: 'px-3' },
  xs: { label: 'px-2' }
} satisfies Record<NonNullable<LinkProps['size']>, { label: string }>;

/**
 * Height, radius, text size, icon size, colors and focus ring all come from `buttonVariants`, via
 * the underlying `Link` rendered as `variant="primary"`. These slots only describe what the split
 * layout adds on top: the root hands its padding and background to the two panels, which then own
 * the interactive states so they can shade independently.
 */
const splitCtaVariants = tv({
  slots: {
    root: [
      'group gap-0 overflow-hidden p-0',
      'bg-transparent hover:bg-transparent focus-visible:bg-transparent pressed:bg-transparent'
    ],
    label: [
      'flex h-full items-center justify-center bg-element-primary transition-colors',
      'group-hover:bg-element-primary-subtle group-data-focus-visible:bg-element-primary-subtle group-data-pressed:bg-element-primary-soft',
      'group-data-disabled:bg-element-neutral group-data-disabled:text-tertiary'
    ],
    iconPanel: [
      'flex aspect-square h-full shrink-0 items-center justify-center bg-element-primary-subtle transition-colors',
      'group-hover:bg-element-primary-soft group-data-focus-visible:bg-element-primary-soft group-data-pressed:bg-element-primary-subtle',
      'group-data-disabled:bg-element-neutral group-data-disabled:text-tertiary',
      '[&_svg]:shrink-0 [&_svg]:transition-transform group-hover:[&_svg]:translate-x-0.5'
    ]
  },

  variants: {
    size: LABEL_PADDING,
    fullWidth: {
      true: {
        root: 'w-full',
        label: 'flex-1'
      }
    }
  },

  // Must track the `buttonVariants` defaults so the label padding matches the size `Link` renders.
  defaultVariants: {
    size: 'l',
    fullWidth: false
  }
});

interface SplitCtaProps extends Omit<LinkProps, 'children' | 'hideExternalLinkIcon' | 'variant'> {
  children: ReactNode;
  icon?: ReactNode;
}

const SplitCta = forwardRef<HTMLAnchorElement, SplitCtaProps>(
  ({ children, className, fullWidth, icon = <ArrowRightIcon />, size, ...props }, ref) => {
    const styles = splitCtaVariants({ fullWidth, size });

    return (
      <Link
        {...props}
        ref={ref}
        variant="primary"
        size={size}
        fullWidth={fullWidth}
        hideExternalLinkIcon
        className={composeRenderProps(className, (className) => styles.root({ className }))}
      >
        <span className={styles.label()}>{children}</span>
        <span aria-hidden="true" className={styles.iconPanel()}>
          {icon}
        </span>
      </Link>
    );
  }
);

SplitCta.displayName = 'ZivoeUI.SplitCta';

export { SplitCta, splitCtaVariants };
export type { SplitCtaProps };
