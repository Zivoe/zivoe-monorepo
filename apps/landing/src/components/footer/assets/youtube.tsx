import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const YoutubeIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
            d="M23.7609 7.60898C23.7609 7.60898 23.5266 5.9543 22.8047 5.22773C21.8906 4.27148 20.8688 4.2668 20.4 4.21055C17.0438 3.9668 12.0047 3.9668 12.0047 3.9668H11.9953C11.9953 3.9668 6.95625 3.9668 3.6 4.21055C3.13125 4.2668 2.10938 4.27148 1.19531 5.22773C0.473438 5.9543 0.24375 7.60898 0.24375 7.60898C0.24375 7.60898 0 9.5543 0 11.4949V13.3137C0 15.2543 0.239062 17.1996 0.239062 17.1996C0.239062 17.1996 0.473437 18.8543 1.19062 19.5809C2.10469 20.5371 3.30469 20.5043 3.83906 20.6074C5.76094 20.7902 12 20.8465 12 20.8465C12 20.8465 17.0438 20.8371 20.4 20.598C20.8688 20.5418 21.8906 20.5371 22.8047 19.5809C23.5266 18.8543 23.7609 17.1996 23.7609 17.1996C23.7609 17.1996 24 15.259 24 13.3137V11.4949C24 9.5543 23.7609 7.60898 23.7609 7.60898ZM9.52031 15.5215V8.77617L16.0031 12.1605L9.52031 15.5215Z"
            fill={color}
          />
        </g>
      </svg>
    );
  }
);
