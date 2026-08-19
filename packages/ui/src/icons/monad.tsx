import React from 'react';

import { type IconProps } from './types';

export const MonadIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
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
      <rect width="32" height="32" rx="16" fill="#836EF9" />
      <path
        d="M16 5.5c-2.905 0-10.5 7.595-10.5 10.5S13.095 26.5 16 26.5 26.5 18.905 26.5 16 18.905 5.5 16 5.5Zm-1.633 16.408c-1.096-.298-4.043-5.454-3.744-6.55.298-1.097 5.453-4.043 6.55-3.745 1.096.298 4.043 5.454 3.744 6.55-.298 1.097-5.454 4.043-6.55 3.745Z"
        fill="white"
      />
    </svg>
  );
});
