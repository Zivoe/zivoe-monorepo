import Image from 'next/image';

import { cn } from '@zivoe/ui/lib/tw-utils';

/** The Lighthouse Horizon mark, pre-cropped to its disc (public/lighthouse-mark.png, 256px). Decorative. */
export function LighthouseMark({ className }: { className?: string }) {
  return (
    <Image
      src="/lighthouse-mark.png"
      alt=""
      aria-hidden="true"
      width={256}
      height={256}
      sizes="48px"
      className={cn('size-8 shrink-0 rounded-full', className)}
    />
  );
}
