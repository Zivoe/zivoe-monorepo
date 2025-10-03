import React from 'react';

import { IconProps } from './types';

export const LineChartIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="21"
        viewBox="0 0 20 21"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M2.2915 9.70703V16.7904M7.42985 4.70703V16.7904M12.5682 12.207V16.7904M17.7065 7.20703V16.7904"
          stroke={color}
          stroke-width="1.5"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
