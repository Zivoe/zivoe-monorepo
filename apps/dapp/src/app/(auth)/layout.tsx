import { type ReactNode } from 'react';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Separator } from '@zivoe/ui/core/separator';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-surface-base lg:grid lg:grid-cols-2 lg:gap-3 lg:p-4">
      <div className="flex flex-1 flex-col">
        {/* Mobile header  */}
        <div className="lg:hidden">
          <div className="flex h-full min-h-[6.25rem] items-center px-4">
            <ZivoeLogo className="w-[5.3rem]" />
          </div>

          <Separator />
        </div>

        <div className="h-full w-full px-6">{children}</div>
      </div>

      {/* Desktop right panel */}
      <div className="hidden rounded-lg bg-primary-600 lg:block" />
    </div>
  );
}
