import React from 'react';

import { IconProps } from './types';

export const DisclosureArrowIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M3.125 3.95703V12.4987H16.6667M16.6667 12.4987L13.3333 9.16536M16.6667 12.4987L13.3333 15.832"
          stroke={color}
          stroke-width="1.5"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
