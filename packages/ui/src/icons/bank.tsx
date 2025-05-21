import React from 'react';

import { IconProps } from './types';

export const BankIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="21"
        height="21"
        viewBox="0 0 21 21"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M16.7085 7.77942V14.4461M13.3752 14.4461V7.77942M4.62516 7.77942V14.4461M7.9585 14.4461V7.77942M2.9585 6.04865L10.6668 2.15442L18.3752 6.04865V7.77942H2.9585V6.04865ZM2.9585 16.9461H18.3752L17.5418 14.4461H3.79183L2.9585 16.9461Z"
          stroke={color}
          strokeWidth="1.25"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
