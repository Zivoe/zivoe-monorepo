'use client';

import { type ReactNode, forwardRef } from 'react';

import { composeRenderProps } from 'react-aria-components';

import { ArrowRightIcon } from '../../icons';
import { type VariantProps, tv } from '../../lib/tw-utils';
import { Link, type LinkProps } from '../link';

const splitCtaVariants = tv({
  slots: {
    root: [
      'group gap-0 overflow-hidden p-0',
      'pressed:bg-transparent bg-transparent hover:bg-transparent focus-visible:bg-transparent'
    ],
    label: [
      'bg-element-primary flex h-full items-center justify-center text-base transition-colors',
      'group-hover:bg-element-primary-subtle group-data-focus-visible:bg-element-primary-subtle group-data-pressed:bg-element-primary-soft',
      'group-data-disabled:bg-element-neutral group-data-disabled:text-tertiary'
    ],
    iconPanel: [
      'bg-element-primary-subtle flex aspect-square h-full shrink-0 items-center justify-center text-base transition-colors',
      'group-hover:bg-element-primary-soft group-data-focus-visible:bg-element-primary-soft group-data-pressed:bg-element-primary-subtle',
      'group-data-disabled:bg-element-neutral group-data-disabled:text-tertiary',
      '[&_svg]:shrink-0 [&_svg]:transition-transform group-hover:[&_svg]:translate-x-0.5'
    ]
  },
  variants: {
    size: {
      l: {
        root: 'text-regular h-12 rounded-sm',
        label: 'px-4',
        iconPanel: '[&_svg]:size-4'
      },
      m: {
        root: 'text-regular h-10 rounded-sm',
        label: 'px-3',
        iconPanel: '[&_svg]:size-4'
      },
      s: {
        root: 'text-small h-8 rounded-xs',
        label: 'px-3',
        iconPanel: '[&_svg]:size-4'
      },
      xs: {
        root: 'text-extraSmall h-6 rounded-xs',
        label: 'px-2',
        iconPanel: '[&_svg]:size-3'
      }
    },
    fullWidth: {
      true: {
        root: 'w-full',
        label: 'flex-1'
      }
    }
  },
  defaultVariants: {
    size: 'l',
    fullWidth: false
  }
});

interface SplitCtaProps
  extends
    Omit<LinkProps, 'children' | 'fullWidth' | 'hideExternalLinkIcon' | 'size' | 'variant'>,
    VariantProps<typeof splitCtaVariants> {
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
