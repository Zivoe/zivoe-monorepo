import React from 'react';

import { type IconProps } from './types';

export const CalendarIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="25"
        height="25"
        viewBox="0 0 25 25"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M7.5 4.5V7M17.5 4.5V7M5 9.5H20M6.5 6H18.5C19.3284 6 20 6.67157 20 7.5V19C20 19.8284 19.3284 20.5 18.5 20.5H6.5C5.67157 20.5 5 19.8284 5 19V7.5C5 6.67157 5.67157 6 6.5 6Z"
          stroke={color}
          strokeWidth="1.25"
          strokeLinecap="square"
        />
        <path d="M8.5 13H10M12 13H13.5M15.5 13H17M8.5 16H10M12 16H13.5" stroke={color} strokeWidth="1.25" />
      </svg>
    );
  }
);
