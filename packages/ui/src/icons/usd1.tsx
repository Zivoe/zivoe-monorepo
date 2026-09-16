import React from 'react';

import { type IconProps } from './types';

/** World Liberty Financial's USD1: a gold coin carrying a "1" — drawn here, not taken from an icon set. */
export const Usd1Icon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
      ref={forwardedRef}
    >
      <rect width="32" height="32" rx="16" fill="#E9A400" />
      <circle cx="16" cy="16" r="12.5" fill="#C9860A" />
      <path d="M19.6 8.2H16.9L12.3 11.5L14 13.8L16.3 12.1V23.8H19.6V8.2Z" fill="#FFF3D1" />
    </svg>
  );
});
