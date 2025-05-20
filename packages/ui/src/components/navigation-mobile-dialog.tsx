import { ReactNode } from 'react';

import { DialogContent } from '../core/dialog';

export default function NavigationMobileDialog({ children }: { children: ReactNode }) {
  return (
    <DialogContent isFullScreen className="bg-element-primary" logoType="light">
      <div className="flex h-full flex-1 -translate-y-10 flex-col items-center gap-6">
        <div className="bg-secondary rounded-4 bg-accent/10 flex h-full flex-col items-center justify-center gap-3">
          {children}
        </div>

        <div className="text-base">©Zivoe 2025. All Right Reserved.</div>
      </div>
    </DialogContent>
  );
}
