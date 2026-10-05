'use client';

import {
  type AnchorHTMLAttributes,
  type HTMLAttributeAnchorTarget,
  type JSX,
  type ReactElement,
  type ReactNode,
  forwardRef
} from 'react';

import NextLinkComponent, { type LinkProps as NextLinkComponentProps } from 'next/link';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { type VariantProps } from 'tailwind-variants';

import { ExternalLinkIcon } from '../../icons';
import { buttonVariants } from '../button';

type Prefetch = NextLinkComponentProps['prefetch'];

interface LinkProps extends Omit<Aria.LinkProps, 'render'>, VariantProps<typeof buttonVariants> {
  hideExternalLinkIcon?: boolean;
  /** Passed to `next/link` for in-app hrefs; leave unset for its default (prefetch near the viewport and on hover). */
  prefetch?: Prefetch;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    {
      prefetch,
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
        render={(domProps) => renderRouterLink({ domProps, fallback: 'span', prefetch })}
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

/**
 * The element behind a React Aria link (`render` prop): an in-app href goes
 * through `next/link`, so the route is prefetched by Next itself, and
 * anything else stays a plain anchor. React Aria keeps the press handling and
 * navigates through the app's `RouterProvider`; a component with no href
 * (a menu item that is not a link) renders its `fallback` element, and so
 * does a disabled one, which React Aria hands its href all the same.
 */
function renderRouterLink({
  domProps,
  fallback,
  prefetch
}: {
  domProps: JSX.IntrinsicElements['a' | 'span' | 'div'];
  fallback: 'span' | 'div';
  prefetch?: Prefetch;
}): ReactElement {
  if (!('href' in domProps) || domProps.href === undefined || domProps['aria-disabled']) {
    return fallback === 'div' ? <div {...(domProps as JSX.IntrinsicElements['div'])} /> : <span {...domProps} />;
  }

  const { href, ...anchorProps } = domProps;
  const isInApp = href.startsWith('/') && !href.startsWith('//') && anchorProps.target !== '_blank';

  return isInApp ? (
    <NextLinkComponent {...anchorProps} href={href} prefetch={prefetch} />
  ) : (
    <a {...anchorProps} href={href} />
  );
}

type NextLinkProps = NextLinkComponentProps &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, keyof NextLinkComponentProps | 'href'> & {
    href: string;
    className?: string;
    target?: HTMLAttributeAnchorTarget;
    rel?: string;
    children?: ReactNode;
  };

/** `next/link` with a safe `rel` on new-tab links; prefetching is Next's own. */
const NextLink = forwardRef<HTMLAnchorElement, NextLinkProps>(
  ({ target = '_self', rel: providedRel, ...props }, ref) => {
    const rel = getSafeRel(target, providedRel);

    return <NextLinkComponent ref={ref} {...props} target={target} rel={rel} />;
  }
);

function getSafeRel(target: HTMLAttributeAnchorTarget | undefined, rel: string | undefined) {
  return target === '_blank' ? (rel ?? 'noopener noreferrer') : rel;
}

Link.displayName = 'ZivoeUI.Link';
NextLink.displayName = 'ZivoeUI.NextLink';

export { Link, NextLink, renderRouterLink };
export type { LinkProps };
