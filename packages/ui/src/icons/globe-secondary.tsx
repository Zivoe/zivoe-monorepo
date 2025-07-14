import React from 'react';

import { IconProps } from './types';

export const GlobeSecondaryIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M16 28.3337C22.8115 28.3337 28.3334 22.8118 28.3334 16.0003C28.3334 9.18881 22.8115 3.66699 16 3.66699M16 28.3337C9.18851 28.3337 3.66669 22.8118 3.66669 16.0003C3.66669 9.18881 9.18851 3.66699 16 3.66699M16 28.3337C12.8704 28.3337 10.3334 22.8118 10.3334 16.0003C10.3334 9.18881 12.8704 3.66699 16 3.66699M16 28.3337C19.1296 28.3337 21.6667 22.8118 21.6667 16.0003C21.6667 9.18881 19.1296 3.66699 16 3.66699M28 16.0003H4.00002"
          stroke={color}
          strokeWidth="2"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
