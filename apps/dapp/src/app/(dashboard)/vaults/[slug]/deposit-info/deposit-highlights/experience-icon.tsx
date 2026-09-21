import React from 'react';

import { type IconProps } from '@zivoe/ui/icons/types';

export const ExperienceIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
      ref={forwardedRef}
    >
      <circle cx="14" cy="12" r="7" />
      <path d="M3 35v-3a10 10 0 0 1 10-10h2a10 10 0 0 1 10 10v3M25 5a7 7 0 0 1 0 14m4 4a10 10 0 0 1 8 9v3" />
    </svg>
  );
});
