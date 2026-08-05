import { type ReactNode } from 'react';

import { DialogContent } from '../core/dialog';
import { copyrightLine } from '../lib/copyright';

export default function NavigationMobileDialog({ children }: { children: ReactNode }) {
  return (
    <DialogContent aria-label="Navigation menu" isFullScreen className="bg-element-primary p-4" logoType="light">
      <div className="flex h-full flex-1 flex-col items-center gap-6">
        <div className="flex h-full flex-col items-center justify-center gap-3">{children}</div>

        <div className="text-base">{copyrightLine()}</div>
      </div>
    </DialogContent>
  );
}
