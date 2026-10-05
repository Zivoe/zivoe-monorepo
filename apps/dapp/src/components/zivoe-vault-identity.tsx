import { type ReactNode } from 'react';

import { SHARE_CLASSES } from '@zivoe/centrifuge-indexer';
import { Badge } from '@zivoe/ui/core/badge';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type ZivoeVault, type ZivoeVaultStatus } from '@/zivoe-vaults';

import TextSkeleton from './text-skeleton';

const NAME_SIZES = { sm: 'font-heading! text-h6', lg: 'font-heading! text-h6 lg:text-h5' };

/**
 * Logo, ticker and name — the identity row the listing card and the Zivoe Vault
 * page header both open with, so the two surfaces cannot drift on how an
 * Zivoe Vault introduces itself.
 */
export default function ZivoeVaultIdentity({
  zivoeVault,
  as: Name = 'p',
  size = 'sm',
  trailing
}: {
  zivoeVault: ZivoeVault;
  /** The name's element — the Zivoe Vault page renders it as that page's h1. */
  as?: 'h1' | 'p';
  /** 'lg' scales the name up on wide screens, where the row is the page header rather than a card. */
  size?: 'sm' | 'lg';
  /** Sits at the end of the ticker line — the status chip on both surfaces. */
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3.5">
      {/* shrink-0 so a wrapping name squeezes its own column, not the logo. */}
      <zivoeVault.Logo className="size-11 shrink-0" />

      {/* min-w-0 so the flex child can shrink below its content and let the name wrap. */}
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-3">
          {/* No uppercase: the ticker is cased by the catalog — zSMB, not ZSMB. */}
          <span className="text-small font-medium text-tertiary">
            {SHARE_CLASSES[zivoeVault.shareClass.key].symbol}
          </span>

          {trailing}
        </div>

        <Name className={cn(NAME_SIZES[size], 'text-primary')}>{zivoeVault.name}</Name>
      </div>
    </div>
  );
}

/** The identity row with its status chip while the Zivoe Vault is on its way: same boxes, pulsing. */
export function ZivoeVaultIdentitySkeleton({ size = 'sm' }: { size?: 'sm' | 'lg' }) {
  return (
    <div className="flex items-center gap-3.5">
      <Skeleton className="size-11 shrink-0 rounded-full" />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-small">
            <TextSkeleton className="w-10" />
          </span>
          <Skeleton className="h-7 w-12 rounded-sm" />
        </div>

        <p className={NAME_SIZES[size]}>
          <TextSkeleton className="w-52" />
        </p>
      </div>
    </div>
  );
}

/**
 * The subscription status chip. Lives next to the identity row because the
 * listing card and the Zivoe Vault page header both trail the row with it, and
 * they must not disagree on how a deploying Zivoe Vault reads.
 */
export function ZivoeVaultStatusBadge({ status }: { status: ZivoeVaultStatus }) {
  // A deploying Zivoe Vault keeps its chip but drops the brand tint — the primary
  // badge reads as "act on this", which is the opposite here.
  return <Badge variant={status === 'Open' ? 'primary' : 'neutral'}>{status}</Badge>;
}
