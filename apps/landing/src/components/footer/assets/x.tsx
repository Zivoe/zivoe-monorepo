import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const XIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="24"
        height="25"
        viewBox="0 0 24 25"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <g id="Social Icons">
          <path
            id="Vector"
            d="M18.3263 2.31348H21.6998L14.3297 10.737L23 22.1994H16.2112L10.894 15.2475L4.80995 22.1994H1.43443L9.31743 13.1896L1 2.31348H7.96111L12.7674 8.66781L18.3263 2.31348ZM17.1423 20.1803H19.0116L6.94539 4.22661H4.93946L17.1423 20.1803Z"
            fill={color}
          />
        </g>
      </svg>
    );
  }
);
