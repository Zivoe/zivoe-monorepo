import React from 'react';

import { type IconProps } from './types';

export const CameraIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M5.5 3.5L4.5 5H2.5C1.94772 5 1.5 5.44772 1.5 6V12C1.5 12.5523 1.94772 13 2.5 13H13.5C14.0523 13 14.5 12.5523 14.5 12V6C14.5 5.44772 14.0523 5 13.5 5H11.5L10.5 3.5H5.5Z"
          stroke={color}
          strokeWidth="1.33"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="8.75" r="2.25" stroke={color} strokeWidth="1.33" />
      </svg>
    );
  }
);
