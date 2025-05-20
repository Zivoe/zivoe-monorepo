import React from 'react';

import { IconProps } from './types';

export const ZivoeIcon = React.forwardRef<SVGSVGElement, IconProps>(
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
        <rect width="48" height="48" rx="24" fill="#F08F48" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M27.1604 7.59296H20.8406L17.6808 13.0618L20.8406 18.5305L24.0004 13.0615H30.32L27.1604 7.59296ZM11.3606 23.9998L8.2007 29.4686L11.3606 34.9374H17.6803L20.84 29.4689H14.5203L11.3604 24.0001L11.3606 23.9998ZM27.1603 18.5316H20.8405L17.6806 24.0003L20.8405 29.4691H27.1603L30.32 24.0003L27.1603 18.5316ZM36.6393 13.0616H30.3195L27.16 18.53H33.4796L36.6394 23.9988L39.7991 18.5303L36.6393 13.0616ZM36.6396 34.9374H30.32L33.4798 29.4686L30.32 23.9998H36.6396L39.7994 29.4686L36.6396 34.9374ZM17.6805 34.9385L20.8402 40.407H27.1599L30.3197 34.9382L27.1599 29.4694L24.0002 34.9385H17.6805ZM11.3605 13.0605H17.6803L14.5206 18.5293L17.6803 23.9979L11.3605 23.9981L8.20068 18.5293L11.3605 13.0605Z"
          fill="#FEFEFE"
        />
      </svg>
    );
  }
);
