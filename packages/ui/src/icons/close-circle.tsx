import React from 'react';

import { IconProps } from './types';

export const CloseCircleIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="32"
        height="33"
        viewBox="0 0 32 33"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M19.9993 12.4998L11.9993 20.4998M19.9993 20.4998L11.9993 12.4998M28.3327 16.4998C28.3327 23.3113 22.8109 28.8332 15.9993 28.8332C9.18784 28.8332 3.66602 23.3113 3.66602 16.4998C3.66602 9.68833 9.18784 4.1665 15.9993 4.1665C22.8109 4.1665 28.3327 9.68833 28.3327 16.4998Z"
          stroke={color}
          stroke-width="1.5"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
