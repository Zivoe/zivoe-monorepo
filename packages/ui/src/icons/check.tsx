import React from 'react';

import { IconProps } from './types';

export const CheckIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <path d="M3.33333 9.56083L6.48648 12.1622L12.6667 3.83786" stroke={color} stroke-linecap="square" />
      </svg>
    );
  }
);
