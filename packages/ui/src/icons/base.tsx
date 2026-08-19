import React from 'react';

import { type IconProps } from './types';

export const BaseIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      ref={forwardedRef}
    >
      <rect width="32" height="32" rx="16" fill="#0052FF" />
      <path
        d="M15.977 26.5c5.808 0 10.523-4.7 10.523-10.5S21.785 5.5 15.977 5.5C10.467 5.5 5.947 9.73 5.5 15.113h13.907v1.774H5.5c.447 5.383 4.967 9.613 10.477 9.613Z"
        fill="white"
      />
    </svg>
  );
});
