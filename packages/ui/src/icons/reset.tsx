import React from 'react';

import { type IconProps } from './types';

/** A counter-clockwise arrow: start over. */
export const ResetIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M2.13 8.5a6.38 6.38 0 1 0 6.37-6.37 6.9 6.9 0 0 0-4.77 1.94L2.13 5.67"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M2.13 2.13v3.54h3.54" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
);
