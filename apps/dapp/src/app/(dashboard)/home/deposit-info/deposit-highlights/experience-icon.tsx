import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const ExperienceIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="62"
      height="41"
      viewBox="0 0 62 41"
      fill="none"
      {...props}
      ref={forwardedRef}
    >
      <g clipPath="url(#clip0_11489_8262)">
        <path
          d="M27.8128 8.97761V3.21582H12.272V8.97761"
          stroke="#231F20"
          strokeWidth="0.679191"
          strokeMiterlimit="10"
        />
        <path
          d="M3.72803 14.7859L16.7121 23.1266C18.7425 24.431 21.3418 24.431 23.3723 23.1267L33.7212 16.4789"
          stroke="#231F20"
          strokeWidth="0.679191"
          strokeMiterlimit="10"
        />
        <path
          d="M33.518 10.9634H3.08441C1.61013 10.9634 0.415039 12.1646 0.415039 13.6463V37.1129C0.415039 38.5947 1.61012 39.7959 3.08441 39.7959H37.0002C38.4744 39.7959 39.6695 38.5947 39.6695 37.1129V25.4235"
          stroke="#231F20"
          strokeWidth="0.679191"
          strokeMiterlimit="10"
        />
        <path
          d="M48.6686 25.3797C55.4681 25.3797 60.9802 19.8395 60.9802 13.0052C60.9802 6.1709 55.4681 0.630615 48.6686 0.630615C41.8691 0.630615 36.3569 6.1709 36.3569 13.0052C36.3569 19.8395 41.8691 25.3797 48.6686 25.3797Z"
          stroke="#231F20"
          strokeWidth="0.679191"
          strokeMiterlimit="10"
        />
        <path
          d="M39.6694 24.9141V35.8456L48.6684 30.6236L57.6672 35.8456V24.9141"
          stroke="#231F20"
          strokeWidth="0.679191"
          strokeMiterlimit="10"
        />
      </g>
      <defs>
        <clipPath id="clip0_11489_8262">
          <rect width="61.3953" height="40" fill="white" transform="translate(0 0.213135)" />
        </clipPath>
      </defs>
    </svg>
  );
});
