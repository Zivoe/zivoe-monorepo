import React from 'react';

import { IconProps } from './types';

export const ChartIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M6.16667 13.5V9.16667H2.5V13.5H6.16667ZM6.16667 13.5H9.83333M6.16667 13.5V2.5H9.83333V13.5M9.83333 13.5H13.5V5.83333H9.83333V13.5Z"
          stroke={color}
          stroke-width="1.5"
          stroke-linecap="square"
        />
      </svg>
    );
  }
);
