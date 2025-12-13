import { type ReactNode } from 'react';

import Image from 'next/image';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Separator } from '@zivoe/ui/core/separator';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-surface-base xl:grid xl:grid-cols-2 xl:gap-3 xl:p-4">
      <div className="flex flex-1 flex-col">
        {/* Mobile header  */}
        <div className="xl:hidden">
          <div className="flex h-full min-h-[6.25rem] items-center px-4">
            <ZivoeLogo className="w-[5.3rem]" />
          </div>

          <Separator />
        </div>

        <div className="h-full w-full px-6">{children}</div>
      </div>

      {/* Desktop right panel */}
      <div className="relative hidden max-h-[calc(100vh-2rem)] items-end justify-end overflow-hidden rounded-xl bg-element-tertiary xl:flex">
        <ZivoeLogo className="absolute left-10 top-10 h-10" />
        <Image
          src="/auth-hero.jpg"
          alt="Hero Element 01"
          width={1686}
          height={2094}
          className="h-full w-auto max-w-none"
        />
      </div>
    </div>
  );
}
