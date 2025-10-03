import React from 'react';

import { IconProps } from './types';

export const DropIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M11.375 8.23018C11.375 10.6106 9.41625 12.5404 7 12.5404C4.58375 12.5404 2.625 10.6106 2.625 8.23018C2.625 4.84361 7 1.45703 7 1.45703C7 1.45703 11.375 4.84361 11.375 8.23018Z"
          stroke={color}
        />
      </svg>
    );
  }
);
