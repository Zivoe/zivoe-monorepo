import React from 'react';

import { IconProps } from './types';

export const StarIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="15"
      viewBox="0 0 14 15"
      fill="none"
      {...props}
      ref={forwardedRef}
    >
      <g clipPath="url(#clip0_12880_4489)">
        <path
          d="M1.896 7.21318C4.37516 6.33818 6.12516 4.58818 7.00016 2.10901C7.87516 4.58818 9.62516 6.33818 12.1043 7.21318C9.62516 8.08818 7.87516 9.83818 7.00016 12.3173C6.12516 9.83818 4.37516 8.08818 1.896 7.21318Z"
          stroke="currentColor"
          strokeLinecap="square"
        />
      </g>
      <defs>
        <clipPath id="clip0_12880_4489">
          <rect width="14" height="14" fill="white" transform="translate(0 0.213135)" />
        </clipPath>
      </defs>
    </svg>
  );
});
