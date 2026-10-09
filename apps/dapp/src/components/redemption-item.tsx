import { type ReactNode } from 'react';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Badge } from '@zivoe/ui/core/badge';
import { Disclosure, DisclosureHeader, DisclosurePanel } from '@zivoe/ui/core/disclosure';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type RedemptionState, type TransactedCentrifugeVault, summarizeRedemptionState } from '@/centrifuge';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

/**
 * One network's in-flight items, the same on the Pending tab and the
 * portfolio: a collapsible header (icon, name, how many items sit under it)
 * over one bounded box of items divided by hairlines. `notice` sits between
 * the two for a partial-read warning; nothing is boxed while there are no
 * items, so a failed read never draws an empty frame.
 */
export function RedemptionChainGroup({
  chain,
  count,
  notice,
  children
}: {
  chain: CentrifugeChain;
  count: number;
  notice?: ReactNode;
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
          {notice}
          {count > 0 && <div className="rounded-lg border border-subtle">{children}</div>}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}

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
 * its control on the right (`action`) and its hints below (`children`);
 * the portfolio adds neither. A status still moving on its own pulses.
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
  /** The control on the right: claim, cancel, or the network switch. */
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
    <div className={cn('flex flex-col gap-1 px-4 py-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={cn('size-2 shrink-0 rounded-full', tone.dot, inMotion && 'motion-safe:animate-pulse')}
          />
          <p className="text-regular font-medium text-primary tabular-nums">{amount}</p>
          <Badge variant={tone.badge} className="shrink-0 py-0.5 text-extraSmall">
            {status}
          </Badge>
        </div>
        {action}
      </div>
      {/* The lines below hang from the amount, past the dot. */}
      {detailLine && <p className="pl-5 text-small text-secondary">{detailLine}</p>}
      {children && <div className="flex flex-col gap-1 pl-5 text-extraSmall text-secondary">{children}</div>}
    </div>
  );
}
