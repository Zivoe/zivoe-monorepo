import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const AutocompoundingIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="443"
        height="227"
        viewBox="0 0 443 227"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <rect x="55.7725" y="182.764" width="64.538" height="78.7358" fill="#E77A37" />
        <rect x="120.31" y="163.215" width="64.538" height="98.2845" fill="#F08F48" />
        <rect x="184.848" y="123.67" width="64.538" height="137.83" fill="#F9A568" />
        <rect x="249.386" y="81.0449" width="64.538" height="180.455" fill="#FFB887" />
        <rect x="313.924" y="37.394" width="64.538" height="224.106" fill="#FFC39A" />
        <rect x="378.462" y="0.927734" width="64.538" height="260.572" fill="#F9D2B6" />
      </svg>
    );
  }
);
