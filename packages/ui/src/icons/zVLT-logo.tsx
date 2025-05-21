import React from 'react';

import { IconProps } from './types';

export const ZVltLogo = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <rect width="48" height="48" rx="24" fill="#F08F48" />
        <g clip-path="url(#clip0_11230_13573)">
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M24.0922 30.4593L20.558 24.3066H13.4871L9.95288 30.4593L13.4871 36.6131H13.4883H13.4871L17.0225 30.4593H24.0922Z"
            fill="#FEFEFE"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M38.2316 30.4593L34.6974 24.3066H27.6277L24.0923 30.4593L27.6277 36.6131L31.162 30.4593H38.2316Z"
            fill="#FEFEFE"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M24.0925 18.1531L20.5582 12.0004H13.4874L9.95312 18.1531L13.4874 24.3069H13.4885H13.4874L17.0228 18.1531H24.0925Z"
            fill="#FEFEFE"
          />
          <path
            fill-rule="evenodd"
            clip-rule="evenodd"
            d="M38.2316 18.1527L34.6974 12.0001H27.6277L24.0923 18.1527L27.6277 24.3065L31.162 18.1527H38.2316Z"
            fill="#FEFEFE"
          />
        </g>
        <defs>
          <clipPath id="clip0_11230_13573">
            <rect width="28.2787" height="24.6129" fill="white" transform="translate(9.95312 12)" />
          </clipPath>
        </defs>
      </svg>
    );
  }
);
