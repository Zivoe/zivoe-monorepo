import React from 'react';

import { type IconProps } from './types';

export const PharosIcon = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
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
      <rect width="32" height="32" rx="16" fill="#0012B8" />
      <g transform="translate(10.59 6.5) scale(0.59375)" fill="white">
        <path d="M3.56543 5.8941L8.59557 4.71816L14.2145 3.40943V0L3.56543 2.35187V5.8941Z" />
        <path d="M15.9901 7.74362L8.59557 4.38379L3.56543 5.55493V5.89572L9.91174 9.27315L15.9901 7.74362Z" />
        <path d="M15.9905 7.74365L9.91064 9.27157L1.6626 11.3515V16.804L9.08266 14.7977L15.9905 12.929V7.74365Z" />
        <path d="M18.2209 18.5255L9.08266 14.3081L1.6626 16.316V16.8072L9.46873 21.1158L18.2209 18.5319V18.5255Z" />
        <path d="M18.2222 18.5337L9.46687 21.1176L0 23.911V32.0002L18.2222 26.0693V18.5337Z" />
      </g>
    </svg>
  );
});
