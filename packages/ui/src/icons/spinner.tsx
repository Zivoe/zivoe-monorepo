import React from 'react';

import { IconProps } from './types';

export const Spinner = React.forwardRef<SVGSVGElement, IconProps>((props, forwardedRef) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="17"
      height="16"
      viewBox="0 0 17 16"
      fill="none"
      {...props}
      ref={forwardedRef}
    >
      <path
        d="M16 8C16 9.26248 15.7012 10.507 15.1281 11.6319C14.5549 12.7568 13.7237 13.7301 12.7023 14.4721"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
});
