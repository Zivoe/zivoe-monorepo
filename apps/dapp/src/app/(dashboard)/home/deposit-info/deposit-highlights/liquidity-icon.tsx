import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const LiquidityIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="56"
      height="40"
      viewBox="0 0 56 40"
      fill="none"
      {...props}
      ref={forwardedRef}
    >
      <g clipPath="url(#clip0_11489_8112)">
        <path
          d="M19.3797 34.4697C27.4421 34.4697 33.9779 27.9339 33.9779 19.8715C33.9779 11.8092 27.4421 5.27332 19.3797 5.27332C11.3173 5.27332 4.78149 11.8092 4.78149 19.8715C4.78149 27.9339 11.3173 34.4697 19.3797 34.4697Z"
          stroke="#231F20"
          strokeWidth="0.73013"
          strokeMiterlimit="10"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M38.7364 31.8729C35.6456 28.7821 34.9869 24.0132 37.124 20.2003L45.6373 5.0116L54.1506 20.2003C56.2878 24.0132 55.6291 28.7821 52.5383 31.8729C48.727 35.6842 42.5477 35.6842 38.7364 31.8729Z"
          stroke="#231F20"
          strokeWidth="0.73013"
          strokeMiterlimit="10"
        />
        <path
          d="M36.6893 12.0336C33.7015 5.4469 27.0831 0.857056 19.3795 0.857056C8.87805 0.857056 0.36499 9.37017 0.36499 19.8716C0.36499 30.373 8.87805 38.8861 19.3795 38.8861C25.0789 38.8861 30.1786 36.3658 33.6637 32.3939"
          stroke="#231F20"
          strokeWidth="0.73013"
          strokeMiterlimit="10"
        />
        <path d="M19.3797 19.8716L10.8 28.4512" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" />
        <path d="M19.3796 19.8716L23.2885 23.7804" stroke="#231F20" strokeWidth="0.73013" strokeMiterlimit="10" />
      </g>
      <defs>
        <clipPath id="clip0_11489_8112">
          <rect width="55.7621" height="38.7592" fill="white" transform="translate(0 0.491943)" />
        </clipPath>
      </defs>
    </svg>
  );
});
