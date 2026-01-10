import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const AutocompoundingIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="72"
      height="40"
      viewBox="0 0 72 40"
      fill="none"
      {...props}
      ref={forwardedRef}
    >
      <g clipPath="url(#clip0_11489_8205)">
        <path
          d="M23.6109 0.430664H11.4836L0.421387 19.5914L11.4836 38.7522L23.6131 38.7486"
          stroke="#231F20"
          strokeWidth="0.73013"
          strokeMiterlimit="10"
        />
        <path
          d="M35.7341 0.430664L24.6758 19.5914L35.7362 38.7486"
          stroke="#231F20"
          strokeWidth="0.73013"
          strokeMiterlimit="10"
        />
        <path
          d="M59.9924 0.430664L48.9341 19.5914L59.9945 38.7486"
          stroke="#231F20"
          strokeWidth="0.73013"
          strokeMiterlimit="10"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M59.9942 0.430664H47.8669L36.8047 19.5914L47.8669 38.7522L59.9964 38.7486L71.0547 19.5878L59.9942 0.430664Z"
          stroke="#231F20"
          strokeWidth="0.73013"
          strokeMiterlimit="10"
        />
        <path
          d="M40.6755 8.9862L35.736 0.430664H23.6086L12.5464 19.5914L23.6086 38.7522L35.7382 38.7486L40.6737 30.1967"
          stroke="#231F20"
          strokeWidth="0.73013"
          strokeMiterlimit="10"
          strokeLinecap="round"
        />
      </g>
      <defs>
        <clipPath id="clip0_11489_8205">
          <rect width="71.4763" height="39.0517" fill="white" transform="translate(0 0.0656738)" />
        </clipPath>
      </defs>
    </svg>
  );
});
