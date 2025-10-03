import React from 'react';

import { IconProps } from './types';

export const CreditIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M1.4585 5.83333V11.375H12.5418V5.83333M1.4585 5.83333V2.625H12.5418V5.83333M1.4585 5.83333H12.5418M3.79183 7.875H5.54183"
          stroke={color}
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
