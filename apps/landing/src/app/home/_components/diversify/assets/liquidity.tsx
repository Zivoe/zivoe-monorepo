import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const LiquidityIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="155"
        height="253"
        viewBox="0 0 155 253"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M0.419924 0.5L77.7058 0.500221L154.992 0.500008V89.7421L77.7058 134.363L0.419922 89.742L0.419924 0.5Z"
          fill="#F9D2B6"
        />
        <path d="M77.7056 0.500213L154.991 0.5V89.7421L77.7056 134.363L77.7056 0.500213Z" fill="#FFC39A" />
        <path
          d="M18.0713 48.2274L86.9456 48.2276L111.912 33.4884L137.341 48.2274V76.5229L77.7061 110.953L18.0713 76.5229L18.0713 48.2274Z"
          fill="#96411A"
        />
        <path
          d="M18.0713 48.2274L86.9456 48.2276L111.912 33.4884L137.341 48.2274V76.5229L77.7061 110.953L18.0713 76.5229L18.0713 48.2274Z"
          fill="#E77A37"
        />
        <path
          d="M77.7061 48.2273L86.9456 48.2275L111.912 33.4883L137.341 48.2273V76.5228L77.7062 110.953L77.7061 48.2273Z"
          fill="#C35928"
        />
        <path
          d="M0.419924 178.984L77.7058 134.363L154.992 178.984V268.226L77.7058 268.226H0.419922L0.419924 178.984Z"
          fill="#F9D2B6"
        />
        <path d="M77.7056 134.363L154.992 178.984V268.226L77.7056 268.226L77.7056 134.363Z" fill="#FFC39A" />
      </svg>
    );
  }
);
