'use client';

import { Badge } from '@zivoe/ui/core/badge';
import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { NextLink } from '@zivoe/ui/core/link';
import { ScrollArea, ScrollBar } from '@zivoe/ui/core/scroll-area';
import { ArrowRightIcon } from '@zivoe/ui/icons';

import {
  REDEMPTION_ITEM_CLASSES,
  RedemptionChainGroup,
  RedemptionGroupSkeleton,
  RedemptionItem,
  StillChecking
} from '@/components/redemption-item';

import { type TransactionIdentity } from '@/centrifuge';
import { type Portfolio } from '@/portfolio';

import { type PortfolioVaultLink } from './portfolio-view';

/**
 * The wallet's in-flight money as a ledger, grouped by network: the same
 * items, groups, notices and loading states as the vault page's Pending tab
 * (one `RedemptionState`, one `RedemptionItem`, one `RedemptionChainGroup`),
 * without their controls. Every action (claim, cancel) lives on that tab,
 * one link away, so the two surfaces can never disagree on what a wallet
 * may do.
 */
export function Redemptions({
  identities,
  portfolio,
  isHolding,
  sharePrice,
  zivoeVault,
  refetch
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  portfolio: Portfolio;
  /** Inside the settle window: the skeleton, like the Pending tab, not a list that grows chain by chain. */
  isHolding: boolean;
  sharePrice: bigint | undefined;
  zivoeVault: PortfolioVaultLink;
  refetch: () => void;
}) {
  const { chains, redemptions, pendingChains, failedPositionChains } = portfolio;

  // One group per chain in deployment order, like the Pending tab: a chain
  // with items, or one whose position read failed (kept, with its notice).
  const chainOrder = [...new Set(identities.map((identity) => identity.centrifugeVault.chain))];
  const groups = chainOrder.flatMap((chain) => {
    const entries = redemptions.filter((entry) => entry.identity.centrifugeVault.chain === chain);
    const hasFailedRead = failedPositionChains.includes(chain);
    return entries.length > 0 || hasFailedRead ? [{ chain, entries, hasFailedRead }] : [];
  });
  // Every vault resolves through the indexer, so every chain failing with
  // nothing loaded is one outage: the Pending tab's one notice with its Retry.
  const isEveryReadFailed =
    chains.length > 0 && failedPositionChains.length === chains.length && redemptions.length === 0;

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

      <CardContent>
        {isHolding ? (
          <RedemptionGroupSkeleton />
        ) : isEveryReadFailed ? (
          <Callout variant="warning">
            Could not load your redemption requests.{' '}
            <Button variant="link-primary" size="s" onPress={refetch}>
              Retry
            </Button>
          </Callout>
        ) : groups.length === 0 ? (
          <div className="flex flex-col gap-2 py-6 text-center text-secondary">
            <p className="text-small">
              No redemption requests. Requests you make on the Redeem tab, funds ready to claim, and cancellations in
              progress will appear here.
            </p>
            <StillChecking chains={pendingChains} className="text-small" />
          </div>
        ) : (
          // Capped like the Pending tab's list from lg, scrolling inside the card; below lg the page scrolls.
          <ScrollArea
            className="-mr-3 lg:max-h-[min(30rem,calc(100dvh-16rem))]"
            viewportClassName="lg:max-h-[min(30rem,calc(100dvh-16rem))]"
          >
            <div className="flex flex-col gap-2 pr-3">
              {groups.map(({ chain, entries, hasFailedRead }) => {
                // Name the vault's coin where the chain has several vaults, exactly like the Pending tab.
                const labelAsset = identities.filter((identity) => identity.centrifugeVault.chain === chain).length > 1;
                return (
                  <RedemptionChainGroup key={chain} chain={chain} count={entries.length} hasFailedRead={hasFailedRead}>
                    {entries.map(({ identity, state }) => (
                      <RedemptionItem
                        key={`${identity.centrifugeVault.address}:${state.kind}`}
                        state={state}
                        centrifugeVault={identity.centrifugeVault}
                        sharePrice={sharePrice}
                        labelAsset={labelAsset}
                        className={REDEMPTION_ITEM_CLASSES}
                      />
                    ))}
                  </RedemptionChainGroup>
                );
              })}
              <StillChecking chains={pendingChains} className="px-1 py-2 text-extraSmall" />
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

/** The whole card while the page's data is on its way. */
export function RedemptionsSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <CardTitle>Redemptions</CardTitle>
      </CardHeader>
      <CardContent>
        <RedemptionGroupSkeleton />
      </CardContent>
    </Card>
  );
}
