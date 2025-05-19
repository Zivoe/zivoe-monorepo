import React from 'react';

import { IconProps } from './types';

export const DiamondIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="8"
        height="8"
        viewBox="0 0 8 8"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <rect x="4" y="0.14209" width="5" height="5" transform="rotate(45 4 0.14209)" fill={color} />
      </svg>
    );
  }
);
