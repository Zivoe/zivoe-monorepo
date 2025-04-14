import React from 'react';

import { IconProps } from './types';

export const GlobeIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="25"
        height="25"
        viewBox="0 0 25 25"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <g id="globus, map, earth, globe" style={{ mixBlendMode: 'luminosity' }}>
          <path
            id=" Icon"
            d="M21.5 12.5C21.5 17.4706 17.4706 21.5 12.5 21.5M21.5 12.5C21.5 7.52944 17.4706 3.5 12.5 3.5M21.5 12.5H3.5M12.5 21.5C7.52944 21.5 3.5 17.4706 3.5 12.5M12.5 21.5C10.2909 21.5 8.5 17.4706 8.5 12.5C8.5 7.52944 10.2909 3.5 12.5 3.5M12.5 21.5C14.7091 21.5 16.5 17.4706 16.5 12.5C16.5 7.52944 14.7091 3.5 12.5 3.5M3.5 12.5C3.5 7.52944 7.52944 3.5 12.5 3.5"
            stroke={color}
            strokeWidth="1.25"
          />
        </g>
      </svg>
    );
  }
);
