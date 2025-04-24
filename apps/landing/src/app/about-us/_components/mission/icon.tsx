import React from 'react';

import { IconProps } from '@zivoe/ui/icons/types';

export const MissionIcon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ color = 'currentColor', ...props }, forwardedRef) => {
    return (
      <svg
        width="81"
        height="81"
        viewBox="0 0 81 81"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
        ref={forwardedRef}
      >
        <rect x="0.425781" y="0.5" width="80" height="80" rx="40" fill="#D4EAFF" />
        <g style={{ mixBlendMode: 'multiply' }}>
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M45.0446 16.5H35.8076L31.1891 24.4996L35.8076 32.4992H35.808L35.8079 32.4991L40.4264 24.4995L49.6631 24.4995L45.0446 16.5ZM21.9496 40.5013L17.332 48.4994L21.9505 56.499H31.1876L35.8059 48.4998L35.806 48.5001H45.0431L49.6613 40.501L54.2791 48.4994L49.6609 56.4985L49.6612 56.499H58.8982L63.5167 48.4994L58.8982 40.4998H49.6612L45.0431 32.5008H35.806L31.1875 40.5004L35.8054 48.499L35.8047 48.5001H26.5677L21.9496 40.5013ZM58.9005 24.4998H49.6635L45.0454 32.4986H54.2791L58.8977 40.4983L58.8972 40.499H58.9005L63.519 32.4994L58.9005 24.4998ZM31.1883 56.4993L31.1877 56.5004L35.8062 64.5H45.0432L49.6617 56.5004L45.0439 48.5021L40.4261 56.5006H31.189L31.1883 56.4993ZM21.9505 24.4984L31.1862 24.4984L26.568 32.4974L31.1865 40.497H31.1879L31.1876 40.4976H21.9505L17.332 32.498L21.9505 24.4984Z"
            fill="#7BADDA"
          />
        </g>
      </svg>
    );
  }
);
