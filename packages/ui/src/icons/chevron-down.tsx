import React from 'react';

import { IconProps } from './types';

export const ChevronDownIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M5.33331 6.66699L7.99998 9.33366L10.6666 6.66699"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
