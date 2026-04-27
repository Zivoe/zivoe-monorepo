import React from 'react';

import { type IconProps } from './types';

export const SearchIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
          d="M14.167 14.166 17.5 17.5m-1.667-8.75a7.083 7.083 0 1 1-14.166 0 7.083 7.083 0 0 1 14.166 0Z"
          stroke={color}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.75"
        />
      </svg>
    );
  }
);
SearchIcon.displayName = 'SearchIcon';
