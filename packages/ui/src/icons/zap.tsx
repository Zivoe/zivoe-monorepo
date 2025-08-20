import React from 'react';

import { IconProps } from './types';

export const ZapIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path d="M20.25 8.75H13.25V2.5L3.75 15.25H10.75V21.5L20.25 8.75Z" stroke={color} strokeWidth="1.5" />
      </svg>
    );
  }
);
