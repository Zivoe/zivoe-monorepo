import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const BankruptcyIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="271"
        height="256"
        viewBox="0 0 271 256"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M180.608 47.0398L180.608 47.0395L180.608 -5.18876L135.377 -31.3029L90.1462 -5.18876L90.1462 47.0393L135.377 20.9255L180.608 47.0396L180.608 47.0398Z"
          fill="#F08F48"
          fillOpacity="0.6"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M135.377 20.9247L135.378 -31.3048L90.1467 -5.1907L90.1467 47.0376L90.1473 47.0379L135.377 20.9245L135.377 20.9247Z"
          fill="#F08F48"
          fillOpacity="0.6"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M135.377 125.38L135.377 125.379L135.377 73.1511L90.1462 47.037L44.9152 73.1511L44.9152 125.378L90.1457 99.2644L135.377 125.378L135.377 125.38Z"
          fill="#F08F48"
          fillOpacity="0.6"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M45.0968 73.3842L45.0959 73.3848L45.0958 177.529L135.288 229.601L225.479 177.529L225.479 73.3883L135.289 125.46L45.0968 73.3877L45.0968 73.3842Z"
          fill="#F08F48"
          fillOpacity="0.8"
        />
        <path
          d="M44.9163 125.381L90.1473 99.2673L135.378 125.381L135.378 177.61L90.1473 203.724L44.9163 177.61L44.9163 125.381Z"
          fill="#E77A37"
        />
        <path
          d="M135.377 125.381L180.608 99.2673L225.839 125.381L225.839 177.61L180.608 203.724L135.377 177.61L135.377 125.381Z"
          fill="#F08F48"
          fillOpacity="0.6"
        />
      </svg>
    );
  }
);
