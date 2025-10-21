import React from 'react';

import { IconProps } from './types';

export const ClockIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M8 5.58333V8.25L9.66667 9.91667M14 8.25C14 11.5637 11.3137 14.25 8 14.25C4.68629 14.25 2 11.5637 2 8.25C2 4.93629 4.68629 2.25 8 2.25C11.3137 2.25 14 4.93629 14 8.25Z"
          stroke={color}
          stroke-width="1.33"
          stroke-linecap="square"
        />
      </svg>
    );
  }
);
