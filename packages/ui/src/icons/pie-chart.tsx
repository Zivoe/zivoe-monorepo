import React from 'react';

import { IconProps } from './types';

export const PieChartIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="14"
        height="15"
        viewBox="0 0 14 15"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <g id="pie chart 2, graph, chart, statistics">
          <path
            id="Icon"
            d="M6.41675 3.18896C6.44449 3.18896 6.47214 3.19045 6.49976 3.19092V7.85498H11.1648C11.1653 7.88281 11.1667 7.91101 11.1667 7.93896C11.1666 10.5622 9.03999 12.689 6.41675 12.689C3.7935 12.689 1.66692 10.5622 1.66675 7.93896C1.66675 5.31561 3.7934 3.18897 6.41675 3.18896ZM8.66675 2.05322C8.97448 2.09043 9.27763 2.16054 9.57007 2.26514L9.76147 2.33936C10.2669 2.54875 10.7262 2.85583 11.113 3.24268C11.4515 3.5812 11.7291 3.97492 11.9333 4.40674L12.0164 4.59424C12.1616 4.94504 12.2561 5.31355 12.3015 5.68896H8.66675V2.05322Z"
            stroke={color}
          />
        </g>
      </svg>
    );
  }
);
