import React from 'react';

import { type IconProps } from './types';

/** Circle's EURC mark: the USDC coin in EURC's blue, a euro sign in place of the dollar. */
export const EurcIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      ref={forwardedRef}
    >
      <rect width="32" height="32" rx="16" fill="#2775CA" />
      <path
        d="M18.9 20.5c-.75.8-1.75 1.25-2.85 1.25-1.85 0-3.4-1.2-3.95-2.9h4.3a.6.6 0 0 0 .6-.6v-.7a.6.6 0 0 0-.6-.6h-4.6a5.6 5.6 0 0 1 0-1.9h4.6a.6.6 0 0 0 .6-.6v-.7a.6.6 0 0 0-.6-.6h-4.3c.55-1.7 2.1-2.9 3.95-2.9 1.1 0 2.1.45 2.85 1.25a.6.6 0 0 0 .85.05l.65-.6a.6.6 0 0 0 .05-.85A5.9 5.9 0 0 0 16.05 8.4c-2.95 0-5.4 2.05-6.05 4.85H8.6a.6.6 0 0 0-.6.6v.7c0 .33.27.6.6.6h1.15a7.5 7.5 0 0 0 0 1.9H8.6a.6.6 0 0 0-.6.6v.7c0 .33.27.6.6.6h1.4c.65 2.8 3.1 4.85 6.05 4.85 1.65 0 3.2-.65 4.35-1.85a.6.6 0 0 0-.05-.85l-.65-.6a.6.6 0 0 0-.85.05Z"
        fill="white"
      />
    </svg>
  );
});
