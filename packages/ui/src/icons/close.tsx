import React from 'react';

import { IconProps } from './types';

export const CloseIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="17"
        height="17"
        viewBox="0 0 17 17"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M3.59229 3.66675L13.259 13.3334M13.259 3.66675L3.59229 13.3334"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
