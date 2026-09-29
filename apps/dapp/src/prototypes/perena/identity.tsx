import { cn } from '@zivoe/ui/lib/tw-utils';

import { PERENA_DEMO } from './config';
import { AlternativeCreditLogo } from './logo';

export function DemoIdentity({ heading = false }: { heading?: boolean }) {
  const Name = heading ? 'h1' : 'p';
  return (
    <div className="flex items-center gap-3.5">
      <AlternativeCreditLogo className="size-11" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-small font-medium text-tertiary">Perena V2 · Solana · Demo</p>
        <Name className={cn('font-heading! text-h6 text-primary', heading && 'lg:text-h5')}>{PERENA_DEMO.name}</Name>
      </div>
    </div>
  );
}

export function DemoArtwork() {
  return (
    <div aria-hidden="true" className="relative h-38 overflow-hidden bg-element-primary">
      <div className="border-white/20 absolute -top-24 -right-10 size-80 rounded-full border" />
      <div className="border-white/25 absolute -top-12 right-2 size-56 rounded-full border" />
      <div className="border-white/30 absolute top-0 right-14 size-32 rounded-full border" />
      <div className="absolute inset-0 flex items-center justify-between px-7 text-base">
        <div>
          <p className="text-small tracking-widest uppercase">A new lending experience</p>
          <p className="mt-2 font-heading! text-h4">Built to explore.</p>
        </div>
        <AlternativeCreditLogo className="size-14" />
      </div>
    </div>
  );
}
