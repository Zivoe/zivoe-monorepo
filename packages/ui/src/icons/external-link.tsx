import React from 'react';

import { IconProps } from './types';

export const ExternalLinkIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="21"
        viewBox="0 0 20 21"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <path
          d="M7.70833 3.55127H3.125V17.3013H16.875V12.7179M11.4583 3.55127H16.875M16.875 3.55127V8.96794M16.875 3.55127L9.16667 11.2596"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="square"
        />
      </svg>
    );
  }
);
