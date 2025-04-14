import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const LinkedInIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <g id="Social Icons" clipPath="url(#clip0_10784_570)">
          <path
            id="Vector"
            d="M22.2234 0.40918H1.77187C0.792187 0.40918 0 1.18262 0 2.13887V22.6748C0 23.6311 0.792187 24.4092 1.77187 24.4092H22.2234C23.2031 24.4092 24 23.6311 24 22.6795V2.13887C24 1.18262 23.2031 0.40918 22.2234 0.40918ZM7.12031 20.8607H3.55781V9.40449H7.12031V20.8607ZM5.33906 7.84355C4.19531 7.84355 3.27188 6.92012 3.27188 5.78105C3.27188 4.64199 4.19531 3.71855 5.33906 3.71855C6.47813 3.71855 7.40156 4.64199 7.40156 5.78105C7.40156 6.91543 6.47813 7.84355 5.33906 7.84355ZM20.4516 20.8607H16.8937V15.292C16.8937 13.9654 16.8703 12.2545 15.0422 12.2545C13.1906 12.2545 12.9094 13.7029 12.9094 15.1982V20.8607H9.35625V9.40449H12.7687V10.9701H12.8156C13.2891 10.0701 14.4516 9.11856 16.1813 9.11856C19.7859 9.11856 20.4516 11.4904 20.4516 14.5748V20.8607Z"
            fill={color}
          />
        </g>
        <defs>
          <clipPath id="clip0_10784_570">
            <rect width="24" height="24" fill={color} transform="translate(0 0.40918)" />
          </clipPath>
        </defs>
      </svg>
    );
  }
);
