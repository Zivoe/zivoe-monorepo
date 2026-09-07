import React from 'react';

import { type IconProps } from './types';

export const XLayerIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
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
      <rect width="32" height="32" rx="16" fill="black" />
      {/* X Layer's OKX mark: the five squares of a 3×3 grid that read as an X. */}
      <g fill="white">
        <rect x="8" y="8" width="5.333" height="5.333" />
        <rect x="18.667" y="8" width="5.333" height="5.333" />
        <rect x="13.333" y="13.333" width="5.333" height="5.333" />
        <rect x="8" y="18.667" width="5.333" height="5.333" />
        <rect x="18.667" y="18.667" width="5.333" height="5.333" />
      </g>
    </svg>
  );
});
