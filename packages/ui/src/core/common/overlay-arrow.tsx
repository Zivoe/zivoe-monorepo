import * as Aria from 'react-aria-components';

import { cn } from '../../lib/tw-utils';

const OverlayArrow = ({ placement, className }: { placement: string; className?: string }) => {
  return (
    <Aria.OverlayArrow className={cn('text-neutral-300', className)}>
      <svg
        width={8}
        height={8}
        viewBox="0 0 8 8"
        fill="currentColor"
        transform={
          placement === 'bottom'
            ? 'rotate(180)'
            : placement === 'left'
              ? 'rotate(270)'
              : placement === 'right'
                ? 'rotate(90)'
                : undefined
        }
      >
        <path d="M0 0 L4 4 L8 0" />
      </svg>
    </Aria.OverlayArrow>
  );
};

export { OverlayArrow };
