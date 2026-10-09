import { type ReactNode } from 'react';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Badge } from '@zivoe/ui/core/badge';
import { Callout } from '@zivoe/ui/core/callout';
import { Disclosure, DisclosureHeader, DisclosurePanel } from '@zivoe/ui/core/disclosure';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type RedemptionState, type TransactedCentrifugeVault, summarizeRedemptionState } from '@/centrifuge';
import { CHAIN_DISPLAY, chainNames } from '@/zivoe-vaults/chain-display';

/**
 * One network's in-flight items, the same on the Pending tab and the
 * portfolio: a collapsible header (icon, name, how many items sit under it)
 * over one bounded box of items divided by hairlines. A chain with a failed
 * position read says so between the two; nothing is boxed while there are
 * no items, so a failed read never draws an empty frame.
 */
export function RedemptionChainGroup({
  chain,
  count,
  hasFailedRead = false,
  children
}: {
  chain: CentrifugeChain;
  count: number;
  /** One of the chain's position reads failed: the items that did load stay, under a notice. */
  hasFailedRead?: boolean;
  children: ReactNode;
}) {
  const { label, Icon } = CHAIN_DISPLAY[chain];
  return (
    <Disclosure defaultExpanded className="py-0">
      <DisclosureHeader className="px-1 py-2 text-regular! font-medium hover:no-underline">
        <span className="flex items-center gap-2">
          <Icon className="size-5 rounded-full" />
          {label}
          <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-extraSmall font-medium text-secondary tabular-nums">
            {count}
          </span>
        </span>
      </DisclosureHeader>

      <DisclosurePanel>
        <div className="flex flex-col gap-2 pb-2">
          {hasFailedRead && <Callout variant="warning">Could not load every position on {label}.</Callout>}
          {count > 0 && <div className="rounded-lg border border-subtle">{children}</div>}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}

/** Items stack inside the group's box, divided by hairlines. */
export const REDEMPTION_ITEM_CLASSES = 'border-b border-subtle last:border-b-0';

/** How each status reads: the dot before the amount and the pill after it, in the system's semantic tones. */
const STATUS_TONES: Record<
  RedemptionState['kind'] | 'blocked',
  { dot: string; badge: 'success' | 'warning' | 'primary' | 'neutral' }
> = {
  returned: { dot: 'bg-element-success', badge: 'success' },
  claimable: { dot: 'bg-element-success', badge: 'success' },
  unfunded: { dot: 'bg-element-warning', badge: 'warning' },
  cancelling: { dot: 'bg-neutral-500', badge: 'neutral' },
  processing: { dot: 'bg-element-primary-soft', badge: 'primary' },
  blocked: { dot: 'bg-neutral-500', badge: 'neutral' }
};

/**
 * One in-flight amount, the same on the vault page's Pending tab and the
 * portfolio's Redemptions card: a status dot, the amount with its status
 * pill beside it, and one line of detail under them. The Pending tab adds
 * its control (`action`) and its hints below (`children`); the portfolio
 * adds neither. From `sm` the control sits to the right of the amount; on
 * phones it takes its own line under the hints, where even the longest
 * pending label has room. A status still moving on its own pulses.
 */
export function RedemptionItem({
  state,
  centrifugeVault,
  sharePrice,
  labelAsset,
  isClaimBlocked = false,
  action,
  children,
  className
}: {
  state: RedemptionState;
  centrifugeVault: TransactedCentrifugeVault;
  sharePrice?: bigint;
  /** Opens the detail line with the vault's coin; set where the network has several vaults. */
  labelAsset: boolean;
  /** This wallet may not claim: the pill says approved, not ready, so it cannot contradict a disabled claim. */
  isClaimBlocked?: boolean;
  /** The control: claim, cancel, or the network switch. */
  action?: ReactNode;
  /** Hint lines under the detail. */
  children?: ReactNode;
  className?: string;
}) {
  const { amount, status, detail, inMotion } = summarizeRedemptionState({
    state,
    centrifugeVault,
    sharePrice,
    isClaimBlocked
  });
  const tone = STATUS_TONES[isClaimBlocked && state.kind === 'claimable' ? 'blocked' : state.kind];
  const detailLine = [labelAsset ? `${centrifugeVault.asset.symbol} redemption` : undefined, detail]
    .filter((part) => part !== undefined)
    .join(' · ');

  return (
    <div className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-4 py-3', className)}>
      {/* The pill drops under the amount before the amount ever breaks. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          aria-hidden="true"
          className={cn('size-2 shrink-0 rounded-full', tone.dot, inMotion && 'motion-safe:animate-pulse')}
        />
        <p className="text-regular font-medium whitespace-nowrap text-primary tabular-nums">{amount}</p>
        <Badge variant={tone.badge} className="py-0.5 text-extraSmall">
          {status}
        </Badge>
      </div>
      {/* The lines below hang from the amount, past the dot. */}
      {detailLine && <p className="col-span-2 pl-5 text-small text-secondary">{detailLine}</p>}
      {/* Hints are paragraphs, which the base stylesheet sizes as body text; the size is set on each. */}
      {children && (
        <div className="col-span-2 flex flex-col gap-1 pl-5 text-extraSmall text-secondary *:text-extraSmall">
          {children}
        </div>
      )}
      {/* On phones a control's pending label may outgrow the row, so it is allowed to wrap there. */}
      {action && (
        <div className="col-span-2 pl-5 sm:col-span-1 sm:col-start-2 sm:row-start-1 sm:self-center sm:pl-0 max-sm:[&_button]:h-auto max-sm:[&_button]:min-h-8 max-sm:[&_button]:text-left max-sm:[&_button]:whitespace-normal">
          {action}
        </div>
      )}
    </div>
  );
}

/** Names the chains whose first position read is still in flight; nothing once all have answered. */
export function StillChecking({ chains, className }: { chains: Array<CentrifugeChain>; className?: string }) {
  if (chains.length === 0) return null;
  return (
    <p aria-live="polite" className={cn('text-secondary', className)}>
      Still checking {chainNames(chains)}…
    </p>
  );
}

/** A network group's silhouette, so loading and loaded share a layout: one header and one boxed item at an item's real height. */
export function RedemptionGroupSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading redemption requests" className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 py-2">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-sm" />
      </div>
      <div className="flex items-start gap-3 rounded-lg border border-subtle px-4 py-3">
        <Skeleton className="mt-2 size-2 rounded-full" />
        <div className="flex flex-1 flex-col gap-1">
          <Skeleton className="h-5 w-28 rounded-sm" />
          <Skeleton className="h-4 w-44 rounded-sm" />
        </div>
        <Skeleton className="h-6 w-20 rounded-sm" />
      </div>
    </div>
  );
}
