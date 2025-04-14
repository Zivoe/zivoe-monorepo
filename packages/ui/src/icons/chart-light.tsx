import React from 'react';

import { IconProps } from './types';

export const ChartLightIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <g style={{ mixBlendMode: 'multiply' }}>
          <path
            d="M9.83 20.5V14.5H4.5V20.5H9.83ZM9.83 20.5H15.16M9.83 20.5V4.5H15.16V20.5M15.16 20.5H20.49V9.5H15.16V20.5Z"
            stroke={color}
            strokeWidth="1.25"
          />
        </g>
      </svg>
    );
  }
);
