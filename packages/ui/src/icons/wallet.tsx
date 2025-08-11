import React from 'react';

import { IconProps } from './types';

export const WalletIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <path
          d="M2.1875 3.79167V10.0625C2.1875 11.029 2.971 11.8125 3.9375 11.8125H11.8125V5.10417H9.47917M2.1875 3.79167C2.1875 4.51654 2.77513 5.10417 3.5 5.10417H9.47917M2.1875 3.79167C2.1875 2.90571 2.90571 2.1875 3.79167 2.1875H9.47917V5.10417"
          stroke={color}
          strokeLinecap="square"
        />
        <path
          d="M9.04199 7.91663C9.341 7.9168 9.58301 8.15957 9.58301 8.45862C9.58283 8.75751 9.34089 8.99946 9.04199 8.99963C8.74295 8.99963 8.50018 8.75762 8.5 8.45862C8.5 8.15946 8.74284 7.91663 9.04199 7.91663Z"
          fill={color}
          stroke={color}
          strokeWidth="0.5"
        />
      </svg>
    );
  }
);
