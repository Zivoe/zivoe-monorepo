import React from 'react';

import { type IconProps } from '@zivoe/ui/icons/types';

export const ReportingIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="53"
      height="40"
      viewBox="0 0 53 40"
      fill="none"
      {...props}
      ref={forwardedRef}
    >
      <rect
        x="0.365"
        y="0.5"
        width="51.93"
        height="30.5"
        rx="2.669"
        stroke="#231F20"
        strokeWidth="0.73013"
        strokeMiterlimit="10"
      />

      <path d="M0.365 7.5H52.295" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" />
      <path d="M7.5 25.8H45.5" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" />

      <rect x="11" y="18.5" width="8" height="7.3" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" />
      <rect x="22.5" y="15.5" width="8" height="10.3" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" />
      <rect x="34" y="11.5" width="8" height="14.3" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" />

      <path d="M26.33 31V36.5" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" />
      <path d="M19.5 36.7H33.16" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" strokeLinecap="round" />
    </svg>
  );
});
