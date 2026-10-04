import React from 'react';

import { type IconProps } from './types';

export const EyeIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      {...props}
      ref={forwardedRef}
    >
      <path
        d="M1.5 8S3.75 3.5 8 3.5 14.5 8 14.5 8 12.25 12.5 8 12.5 1.5 8 1.5 8Z"
        stroke={color}
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke={color} strokeWidth="1.25" />
    </svg>
  )
);
EyeIcon.displayName = 'EyeIcon';
