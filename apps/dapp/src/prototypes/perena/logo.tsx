import Image from 'next/image';

import { cn } from '@zivoe/ui/lib/tw-utils';

/** Two interwoven diamond links share zSMB's exact orange and angular visual language. */
export function AlternativeCreditLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/prototypes/perena/alternative-credit-logo.svg"
      alt=""
      aria-hidden="true"
      width={48}
      height={48}
      unoptimized
      className={cn('size-12 shrink-0', className)}
    />
  );
}
