'use client';

import { HTMLAttributeAnchorTarget, ReactNode, forwardRef } from 'react';

import NextLinkComponent, { LinkProps as NextLinkComponentProps } from 'next/link';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { VariantProps } from 'tailwind-variants';

import { usePrefetch } from '../../hooks/usePrefetch';
import { ExternalLinkIcon } from '../../icons';
import { buttonVariants } from '../button';

interface LinkProps extends Aria.LinkProps, VariantProps<typeof buttonVariants> {
  hideExternalLinkIcon?: boolean;
  prefetch?: boolean;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      prefetch = true,
      href,
      className,
      fullWidth,
      variant = 'link-primary',
      hideExternalLinkIcon = false,
      size,
      target = '_self',
      children,
      ...props
    },
    ref
  ) => {
    usePrefetch({ href, target, enabled: prefetch });

    return (
      <Aria.Link
        className={composeRenderProps(className, (className) =>
          buttonVariants({
            variant,
            size,
            fullWidth,
            className
          })
        )}
        href={href}
        target={target}
        {...props}
        ref={ref}
      >
        {composeRenderProps(children, (children) => (
          <>
            {children}
            {target === '_blank' && !hideExternalLinkIcon ? <ExternalLinkIcon /> : null}
          </>
        ))}
      </Aria.Link>
    );
  }
);

type NextLinkProps = NextLinkComponentProps & {
  href: string;
  prefetch?: boolean;
  className?: string;
  target?: HTMLAttributeAnchorTarget;
  children?: ReactNode;
};

const NextLink = forwardRef<HTMLAnchorElement, NextLinkProps>(
  ({ target = '_self', prefetch = true, ...props }, ref) => {
    usePrefetch({ href: props.href, target: target, enabled: prefetch });
    return <NextLinkComponent ref={ref} {...props} target={target} prefetch={false} />;
  }
);

Link.displayName = 'ZivoeUI.Link';
NextLink.displayName = 'ZivoeUI.NextLink';

export { Link, NextLink };
export type { LinkProps };
