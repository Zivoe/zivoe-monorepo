import React from 'react';

import { IconProps } from '../../../../../../../packages/ui/src/icons/types';

export const ZinclusiveIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 48 48"
        fill="none"
        {...props}
        ref={forwardedRef}
      >
        <rect width="48" height="48" rx="4" fill="#03C1C1" />
        <path
          d="M35.9959 36.3744H12V30.9507L25.3874 16.8991H12.3634V10.5H36.1494V15.7214L23.1661 29.5253H35.9928V36.3744H35.9959ZM35.056 35.4684V30.4312H21.0451L35.2095 15.3711V11.406H13.3033V15.9932H27.5273L12.9399 31.304V35.4684H35.056Z"
          fill="white"
        />
      </svg>
    );
  }
);
