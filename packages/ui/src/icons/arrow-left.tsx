import React from 'react';

import { IconProps } from './types';

export const ArrowLeftIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M7.41667 13.2327L2.75 8.56607L7.41667 3.89941M14.25 8.56607L3.16667 8.56608"
          stroke={color}
          strokeWidth="1.5"
        />
      </svg>
    );
  }
);
