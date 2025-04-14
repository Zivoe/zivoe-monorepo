import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const EthereumIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="185"
        height="181"
        viewBox="0 0 185 181"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M43.1744 75.6855L85.7076 100.242V149.355L43.1744 173.912L0.641113 149.355L0.641113 100.242L43.1744 75.6855Z"
          fill="#FFC39A"
        />
        <path
          d="M106.632 0.00683594L184.843 45.1624V135.473L106.632 180.629L28.4199 135.473L28.4199 45.1624L106.632 0.00683594Z"
          fill="#F08F48"
        />
        <path d="M106.221 75.4745V36.8564L73.8105 90.0416L106.221 75.4745Z" fill="white" />
        <path
          d="M106.221 108.991V75.4745L73.8105 90.0416L106.221 108.991ZM106.221 75.4745L138.637 90.0416L106.221 36.8564V75.4745Z"
          fill="#FFD7BD"
        />
        <path d="M106.22 75.4761V108.993L138.636 90.0432L106.22 75.4761Z" fill="#F69A5D" />
        <path d="M106.221 115.063L73.8105 96.1255L106.221 141.294V115.063Z" fill="white" />
        <path d="M138.654 96.1255L106.22 115.063V141.294L138.654 96.1255Z" fill="#FFD7BD" />
      </svg>
    );
  }
);
