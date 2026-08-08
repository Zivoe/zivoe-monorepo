import React from 'react';

import { type IconProps } from './types';

export const ZAltLogo = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color: _color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="48"
        height="48"
        viewBox="0 0 630 630"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <rect width="630" height="630" rx="315" fill="#F08F48" />
        <path
          d="M401.127 389.962L351.402 303.403H450.854L500.579 389.962L450.854 476.523H351.402L401.127 389.962ZM228.873 389.962H328.324L278.598 476.523H179.146L129.421 389.962L179.146 303.403L228.873 389.962ZM315 240.038L265.275 326.597L215.549 240.038L265.275 153.478H364.725L414.451 240.038H315Z"
          fill="white"
        />
      </svg>
    );
  }
);
