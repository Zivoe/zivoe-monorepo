import React from 'react';

import { IconProps } from './types';

export const TrendingIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="21"
      viewBox="0 0 20 21"
      fill="none"
      {...props}
      ref={forwardedRef}
    >
      <path
        d="M13.1251 5.69604H17.7084V10.2794M17.2802 6.13354L10.8334 12.571L7.50008 9.23771L2.29175 14.446"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
    </svg>
  );
});
