'use client';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Badge } from '@zivoe/ui/core/badge';
import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { NextLink } from '@zivoe/ui/core/link';
import { ScrollArea, ScrollBar } from '@zivoe/ui/core/scroll-area';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { ArrowRightIcon } from '@zivoe/ui/icons';

import { RedemptionChainGroup, RedemptionItem } from '@/components/redemption-item';

import { type TransactionIdentity } from '@/centrifuge';
import { type Portfolio, type RedemptionEntry } from '@/portfolio';
import { chainNames } from '@/zivoe-vaults/chain-display';

import { type PortfolioVaultLink } from './portfolio-view';

/**
 * The wallet's in-flight money as a ledger, grouped by network: the same
 * items as the vault page's Pending tab (one `RedemptionState`, one
 * `RedemptionItem`), without their controls. Every action (claim, cancel)
 * lives on that tab, one link away, so the two surfaces can never disagree
 * on what a wallet may do.
 */
export function Redemptions({
  identities,
  portfolio,
  isHolding,
  sharePrice,
  zivoeVault,
  refetch,
  isRefetching
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  portfolio: Portfolio;
  /** Inside the settle window: the skeleton strip, like the Pending tab, not a list that grows chain by chain. */
  isHolding: boolean;
  sharePrice: bigint | undefined;
  zivoeVault: PortfolioVaultLink;
  refetch: () => void;
  isRefetching: boolean;
}) {
  const { chains, redemptions, pendingChains, failedPositionChains: failedChains } = portfolio;
  const groups = groupByChain(redemptions);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Redemptions</CardTitle>
        <div className="flex items-center gap-4">
          {!isHolding && redemptions.length > 0 && <Badge variant="neutral">{redemptions.length} open</Badge>}
          <NextLink
            href={`${zivoeVault.path}?view=pending`}
            className="flex items-center gap-1.5 text-small font-medium text-brand-subtle hover:underline"
          >
            Manage in {zivoeVault.name}
            <ArrowRightIcon className="size-4" />
          </NextLink>
        </div>
      </CardHeader>

      <CardContent className="gap-4">
        {failedChains.length > 0 && (
          <Callout variant="warning">
            {/* Every vault resolves through the indexer: all of them failing is one outage, worded like the Pending tab. */}
            {failedChains.length === chains.length
              ? 'Could not load your redemption requests.'
              : `Could not load every position on ${chainNames(failedChains)}.`}{' '}
            <Button variant="link-primary" size="s" onPress={refetch} isDisabled={isRefetching}>
              Retry
            </Button>
          </Callout>
        )}

        {isHolding && <RedemptionsSkeletonStrip />}

        {!isHolding && groups.length === 0 && failedChains.length === 0 && (
          <p className="py-4 text-center text-small text-secondary">
            No redemption requests. Requests you make on the Redeem tab, funds ready to claim, and cancellations in
            progress will appear here.
          </p>
        )}

        {/* Capped like the Pending tab's list from lg, scrolling inside the card; below lg the page scrolls. */}
        {!isHolding && groups.length > 0 && (
          <ScrollArea
            className="-mr-3 lg:max-h-[min(30rem,calc(100dvh-16rem))]"
            viewportClassName="lg:max-h-[min(30rem,calc(100dvh-16rem))]"
          >
            <div className="flex flex-col gap-2 pr-3">
              {groups.map(({ chain, entries }) => {
                // Name the vault's coin where the chain has several vaults, exactly like the Pending tab.
                const labelAsset = identities.filter((identity) => identity.centrifugeVault.chain === chain).length > 1;
                return (
                  <RedemptionChainGroup key={chain} chain={chain} count={entries.length}>
                    {entries.map(({ identity, state }) => (
                      <RedemptionItem
                        key={`${identity.centrifugeVault.address}:${state.kind}`}
                        state={state}
                        centrifugeVault={identity.centrifugeVault}
                        sharePrice={sharePrice}
                        labelAsset={labelAsset}
                        className="border-b border-subtle last:border-b-0"
                      />
                    ))}
                  </RedemptionChainGroup>
                );
              })}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        )}

        {!isHolding && pendingChains.length > 0 && (
          <p aria-live="polite" className="text-extraSmall text-secondary">
            Still checking {chainNames(pendingChains)}…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** A network group's silhouette, the Pending tab's own: one header and one boxed item at an item's real height. */
export function RedemptionsSkeletonStrip() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading redemption requests" className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1 py-2">
        <Skeleton className="size-5 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-sm" />
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

/** The whole card while the page's data is on its way. */
export function RedemptionsSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <CardTitle>Redemptions</CardTitle>
      </CardHeader>
      <CardContent className="gap-4">
        <RedemptionsSkeletonStrip />
      </CardContent>
    </Card>
  );
}

function groupByChain(entries: ReadonlyArray<RedemptionEntry>) {
  const groups: Array<{ chain: CentrifugeChain; entries: Array<RedemptionEntry> }> = [];
  for (const entry of entries) {
    const chain = entry.identity.centrifugeVault.chain;
    const group = groups.find((candidate) => candidate.chain === chain);
    if (group) group.entries.push(entry);
    else groups.push({ chain, entries: [entry] });
  }
  return groups;
}
