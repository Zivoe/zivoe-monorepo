'use client';

import { type HTMLAttributeAnchorTarget, type ReactNode, forwardRef } from 'react';

import NextLinkComponent, { type LinkProps as NextLinkComponentProps } from 'next/link';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps } from 'tailwind-variants';

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
      rel: providedRel,
      children,
      ...props
    },
    ref
  ) => {
    usePrefetch({ href, target, enabled: prefetch });
    const rel = getSafeRel(target, providedRel);

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
        rel={rel}
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
  rel?: string;
  children?: ReactNode;
};

const NextLink = forwardRef<HTMLAnchorElement, NextLinkProps>(
  ({ target = '_self', prefetch = true, rel: providedRel, ...props }, ref) => {
    usePrefetch({ href: props.href, target: target, enabled: prefetch });
    const rel = getSafeRel(target, providedRel);

    return <NextLinkComponent ref={ref} {...props} target={target} rel={rel} prefetch={false} />;
  }
);

function getSafeRel(target: HTMLAttributeAnchorTarget | undefined, rel: string | undefined) {
  return target === '_blank' ? (rel ?? 'noopener noreferrer') : rel;
}

Link.displayName = 'ZivoeUI.Link';
NextLink.displayName = 'ZivoeUI.NextLink';

export { Link, NextLink };
export type { LinkProps };
