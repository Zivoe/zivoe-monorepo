import React from 'react';

import { IconProps } from './types';

export const ChevronRightIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M6.5 3.16675L11.3619 8.02866C11.6223 8.28901 11.6223 8.71112 11.3619 8.97147L6.5 13.8334"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
);
