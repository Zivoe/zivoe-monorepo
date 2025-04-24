import React from 'react';

import { IconProps } from './types';

export const ArrowRightIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M9.58333 3.89941L14.25 8.56607L9.58333 13.2327M2.75 8.56607L13.8333 8.56608"
          stroke={color}
          strokeWidth="1.5"
        />
      </svg>
    );
  }
);
