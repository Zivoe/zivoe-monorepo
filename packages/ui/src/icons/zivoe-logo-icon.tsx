import React from 'react';

import { IconProps } from '../icons/types';

export const ZivoeLogoIcon = React.forwardRef<SVGSVGElement, IconProps & { type?: 'dark' | 'light' }>(
  ({ color = 'currentColor', type = 'dark', ...props }, forwardedRef) => {
    const fill = type === 'dark' ? '#12131A' : '#FEFEFE';

    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M22.1583 26.6667L19.0792 31.9998H12.921L9.84186 26.6667H16.0001L19.0792 21.3337L22.1583 26.6667ZM22.1583 15.9998L19.0792 21.3337H12.921L12.92 21.3328L9.84186 26.6658H3.68365L0.604553 21.3328L3.68365 15.9998L6.76276 21.3328H12.92L9.84186 15.9998L12.921 10.6667H19.0792L22.1583 15.9998ZM31.3956 21.3328L28.3165 26.6658H22.1583L25.2374 21.3328L22.1583 15.9998H28.3165L31.3956 21.3328ZM31.3956 10.6658L28.3165 15.9988L25.2374 10.6658H19.0792L22.1583 5.33276H28.3165L31.3956 10.6658ZM6.76276 10.6648L9.84186 15.9978H3.68365L0.604553 10.6648L3.68365 5.33179H9.84186L6.76276 10.6648ZM22.1583 5.33276H16.0001L12.921 10.6658L9.84186 5.33276L12.921 -0.000244141H19.0792L22.1583 5.33276Z"
          fill="#F08F48"
        />
      </svg>
    );
  }
);
