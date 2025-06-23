import React from 'react';

import { IconProps } from './types';

export const CheckCircleIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M19.9993 12.6665L13.9993 19.9998L11.3327 17.3332M28.3327 15.9998C28.3327 22.8113 22.8109 28.3332 15.9993 28.3332C9.18784 28.3332 3.66602 22.8113 3.66602 15.9998C3.66602 9.18833 9.18784 3.6665 15.9993 3.6665C22.8109 3.6665 28.3327 9.18833 28.3327 15.9998Z"
          stroke={color}
          stroke-width="2"
          stroke-linecap="square"
        />
      </svg>
    );
  }
);
