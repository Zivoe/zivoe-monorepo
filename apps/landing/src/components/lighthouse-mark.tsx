import Image from 'next/image';

import { cn } from '@zivoe/ui/lib/tw-utils';

export function LighthouseMark({ className }: { className?: string }) {
  return (
    // Preserve the approved Horizon mark's circular framing at both CTA sizes.
    <span
      aria-hidden="true"
      className={cn('relative inline-block size-10 shrink-0 overflow-hidden rounded-full', className)}
    >
      <Image
        src="/lighthouse-horizon.png"
        alt=""
        width={1280}
        height={1280}
        sizes="60px"
        className="absolute -top-[22%] -left-[21.5%] h-[146%] w-[146%] max-w-none"
      />
    </span>
  );
}
