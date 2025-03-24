import React from 'react';

import { IconProps } from './types';

export const HamburgerIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="17"
        viewBox="0 0 16 17"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M2.49414 3.70117H13.4941M2.49414 8.5345H13.4941M2.49414 13.3678H13.4941"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
