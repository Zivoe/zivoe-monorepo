import { type ReactNode } from 'react';

import { SHARE_CLASS_CATALOG } from '@zivoe/centrifuge-indexer';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type Offering } from '@/offerings';

/**
 * Logo, ticker and name — the identity row the listing card and the Offering
 * page header both open with, so the two surfaces cannot drift on how an
 * Offering introduces itself.
 */
export default function OfferingIdentity({
  offering,
  as: Name = 'p',
  size = 'sm',
  trailing
}: {
  offering: Offering;
  /** The name's element — the Offering page renders it as that page's h1. */
  as?: 'h1' | 'p';
  /** 'lg' scales the name up on wide screens, where the row is the page header rather than a card. */
  size?: 'sm' | 'lg';
  /** Sits at the end of the ticker line — the listing card's status chip. */
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5">
      {/* shrink-0 so a wrapping name squeezes its own column, not the logo. */}
      <offering.Logo className="size-11 shrink-0" />

      {/* min-w-0 so the flex child can shrink below its content and let the name wrap. */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-3">
          {/* No uppercase: the ticker is cased by the catalog — zSMB, not ZSMB. */}
          <span className="text-small font-medium text-tertiary">
            {SHARE_CLASS_CATALOG[offering.shareClass.key].symbol}
          </span>

          {trailing}
        </div>

        <Name className={cn('font-heading! text-h6 text-primary', size === 'lg' && 'lg:text-h5')}>{offering.name}</Name>
      </div>
    </div>
  );
}
