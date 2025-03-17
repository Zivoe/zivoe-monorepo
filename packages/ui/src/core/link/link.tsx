'use client';

import { forwardRef } from 'react';

import * as Aria from 'react-aria-components';
import { composeRenderProps } from 'react-aria-components';
import { VariantProps } from 'tailwind-variants';

import { ExternalLinkIcon } from '../../icons';
import { buttonVariants } from '../button';

interface LinkProps extends Aria.LinkProps, Omit<VariantProps<typeof buttonVariants>, 'fullWidth'> {
  hideExternalLinkIcon?: boolean;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(
  (
    { className, variant = 'link-primary', hideExternalLinkIcon = false, size, target = '_self', children, ...props },
    ref
  ) => {
    return (
      <Aria.Link
        className={composeRenderProps(className, (className) =>
          buttonVariants({
            variant,
            size,
            className
          })
        )}
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

Link.displayName = 'ZivoeUI.Link';

export { Link };
export type { LinkProps };
