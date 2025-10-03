import React from 'react';

import { IconProps } from './types';

export const HourglassIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M8.00008 8.75L4.00008 6.08333V2.75H12.0001V6.08333L8.00008 8.75ZM8.00008 8.75L12.0001 11.4167V14.75H4.00008V11.4167L8.00008 8.75ZM13.3334 14.75H2.66675M13.3334 2.75H2.66675"
          stroke={color}
          stroke-width="1.33"
          stroke-linecap="square"
        />
      </svg>
    );
  }
);
