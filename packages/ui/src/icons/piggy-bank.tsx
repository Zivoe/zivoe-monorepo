import React from 'react';

import { IconProps } from './types';

export const PiggyBankIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <g clipPath="url(#clip0_40000728_3546)">
          <circle cx="4.81217" cy="6.27085" r="0.729167" fill={color} />
          <path
            d="M11.5019 8.47928C11.7028 8.02719 11.8145 7.52663 11.8145 7C11.8145 4.98646 10.1822 3.35417 8.16867 3.35417H5.83534C5.79644 3.35417 5.75769 3.35478 5.71908 3.35599C4.85567 2.32114 3.72612 2.1875 3.35384 2.1875V4.32898C2.95173 4.70273 2.63413 5.16618 2.4329 5.6875H1.02051V8.3125H2.4329C2.63413 8.83382 2.95173 9.29727 3.35384 9.67102V11.8125H5.97884V10.6458H8.02051V11.8125H10.6455V9.67535C11.0064 9.34113 11.2995 8.9348 11.5019 8.47928ZM11.5019 8.47928C11.7159 8.73396 12.0368 8.89583 12.3955 8.89583C13.0398 8.89583 13.5622 8.3735 13.5622 7.72917C13.5622 7.45327 13.4664 7.19973 13.3063 7"
            stroke={color}
            strokeLinecap="square"
          />
        </g>
        <defs>
          <clipPath id="clip0_40000728_3546">
            <rect width="14" height="14" fill="white" />
          </clipPath>
        </defs>
      </svg>
    );
  }
);
