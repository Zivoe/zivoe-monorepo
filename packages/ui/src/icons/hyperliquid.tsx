import React from 'react';

import { type IconProps } from './types';

export const HyperliquidIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
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
      <rect width="32" height="32" rx="16" fill="#072723" />
      {/* The Hyperliquid mark from @web3icons/core (MIT), scaled from its 24-unit frame. */}
      <g transform="scale(1.3333)" fill="#50D2C1">
        <path d="M20 11.942a9 9 0 0 1-.8 3.795c-.772 1.72-2.62 3.127-4.309 1.63-1.377-1.22-1.632-3.698-3.695-4.06-2.729-.333-2.795 2.854-4.578 3.214-1.987.407-2.646-2.96-2.617-4.488.03-1.529.433-3.678 2.16-3.678 1.987 0 2.121 3.031 4.644 2.867 2.498-.172 2.542-3.325 4.174-4.675 1.408-1.166 3.065-.311 3.894 1.093.769 1.298 1.107 2.822 1.124 4.302z" />
      </g>
    </svg>
  );
});
