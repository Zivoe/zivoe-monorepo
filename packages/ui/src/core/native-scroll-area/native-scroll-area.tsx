import React from 'react';

import { tv } from '../../lib/tw-utils';

type NativeScrollAreaProps = { className?: string; children: React.ReactNode };

const nativeScrollAreaStyles = tv({
  base: 'scrollbar-thumb-rounded-full scrollbar-thumb-neutral-800 scrollbar-thin scrollbar-track-transparent overflow-auto px-[2px] py-[1px]'
});

const NativeScrollArea = React.forwardRef<HTMLDivElement, NativeScrollAreaProps>(({ className, children }, ref) => (
  <div className={nativeScrollAreaStyles({ className })} ref={ref}>
    {children}
  </div>
));

NativeScrollArea.displayName = 'ZivoeUI.NativeScrollArea';

export { NativeScrollArea, nativeScrollAreaStyles };
