'use client';

import { Fragment, useEffect, useRef } from 'react';

import { type Address } from 'viem';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { Dialog, DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { NextLink } from '@zivoe/ui/core/link';
import { ScrollArea, ScrollBar } from '@zivoe/ui/core/scroll-area';
import { ExternalLinkIcon } from '@zivoe/ui/icons';

import { getViemChain } from '@/lib/chains';
import { formatBigIntWithCommas } from '@/lib/utils';

import { formatDayLabel } from '@/components/chart/axis';
import TextSkeleton from '@/components/text-skeleton';

import { type TransactionIdentity } from '@/centrifuge';
import { type ActivityEntry, type ActivityKind, usePortfolioActivity } from '@/portfolio';
import { CHAIN_DISPLAY } from '@/zivoe-vaults/chain-display';

const LABELS: Record<ActivityKind, string> = {
  deposit: 'Deposited',
  'redemption-requested': 'Redemption requested',
  'redemption-processed': 'Redemption processed',
  'proceeds-claimed': 'Proceeds claimed',
  issued: 'Issued by Zivoe',
  returned: 'Returned from cancellation',
  received: 'Received',
  sent: 'Sent'
};

const RECENT_COUNT = 5;

/** What happened to the wallet's shares, newest first; the dialog walks the whole history. */
export function Activity({
  identities,
  accountAddress
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  accountAddress: Address;
}) {
  const feed = usePortfolioActivity({ identities, accountAddress });
  const share = identities[0]!.centrifugeVault.shareClass;
  const recent = feed.entries.slice(0, RECENT_COUNT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity</CardTitle>
        {(feed.entries.length > RECENT_COUNT || feed.hasNextPage) && (
          <Dialog>
            <Button variant="link-primary" size="s" className="px-0">
              View all
            </Button>
            <DialogContent dialogClassName="gap-0">
              <DialogHeader>
                <DialogTitle>All {share.symbol} activity</DialogTitle>
              </DialogHeader>
              <DialogContentBox className="gap-0 py-2">
                <AllActivityList feed={feed} share={share} />
              </DialogContentBox>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent className="gap-2">
        {feed.status === 'pending' ? (
          <ActivitySkeletonRows />
        ) : feed.status === 'error' ? (
          <Callout variant="warning">
            Could not load your activity.{' '}
            <Button variant="link-primary" size="s" onPress={feed.refetch}>
              Retry
            </Button>
          </Callout>
        ) : recent.length === 0 ? (
          <p className="py-4 text-center text-small text-secondary">
            No activity yet. Deposits, redemption requests and claims will appear here.
          </p>
        ) : (
          <ul className="flex flex-col">
            {recent.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} share={share} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The whole history, scrolling inside the dialog so the title and its close
 * button stay put. The next page loads as the reader nears the end: a
 * sentinel under the list asks for it when it scrolls into view.
 */
function AllActivityList({
  feed,
  share
}: {
  feed: ReturnType<typeof usePortfolioActivity>;
  share: TransactionIdentity['centrifugeVault']['shareClass'];
}) {
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasNextPage) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !isFetchingNextPage) fetchNextPage();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <ScrollArea
      className="-mr-3 max-h-[min(32rem,calc(100dvh-14rem))]"
      viewportClassName="max-h-[min(32rem,calc(100dvh-14rem))]"
    >
      {/* Room between the figures and the scrollbar, and the same inset the networks dialog gives its rows. */}
      <div className="flex flex-col py-3 pr-5">
        <ul className="flex flex-col">
          {feed.entries.map((entry) => (
            <ActivityRow key={entry.id} entry={entry} share={share} />
          ))}
        </ul>
        {hasNextPage && (
          <div ref={sentinelRef} role="status" className="py-3 text-small text-secondary">
            {isFetchingNextPage ? 'Loading more…' : ''}
          </div>
        )}
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
}

/** Rows shaped like ActivityRow: a label over the chain and date, the amount on the right. */
export function ActivitySkeletonRows({ count = RECENT_COUNT }: { count?: number }) {
  return (
    <ul aria-busy="true" aria-label="Loading activity" className="flex flex-col">
      {Array.from({ length: count }, (_, index) => (
        <li
          key={index}
          className="flex items-center justify-between gap-4 border-b border-subtle py-3 first:pt-0 last:border-b-0 last:pb-0"
        >
          {/* Each pulse sits inside the text line it stands in for, so the rows keep the loaded rows' height and spacing. */}
          <div className="flex flex-col gap-0.5">
            <p className="text-small">
              <TextSkeleton className="w-36" />
            </p>
            <p className="text-extraSmall">
              <TextSkeleton className="w-24" />
            </p>
          </div>
          <p className="text-small">
            <TextSkeleton className="w-20" />
          </p>
        </li>
      ))}
    </ul>
  );
}

/** The whole card while the page's data is on its way: five rows, like the loaded card. */
export function ActivitySkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardContent className="gap-2">
        <ActivitySkeletonRows count={RECENT_COUNT} />
      </CardContent>
    </Card>
  );
}

function ActivityRow({
  entry,
  share
}: {
  entry: ActivityEntry;
  share: TransactionIdentity['centrifugeVault']['shareClass'];
}) {
  const { label: chainLabel, Icon } = CHAIN_DISPLAY[entry.chain];
  const explorer = getViemChain(entry.chain).blockExplorers?.default.url;
  const shares =
    entry.shares === null
      ? null
      : `${formatBigIntWithCommas({ value: entry.shares, tokenDecimals: share.decimals, displayDecimals: 2, showUnderZero: true })} ${share.symbol}`;
  const assets =
    entry.assets === null
      ? null
      : `${formatBigIntWithCommas({ value: entry.assets.amount, tokenDecimals: entry.assets.decimals, displayDecimals: 2, showUnderZero: true })} ${entry.assets.symbol}`;
  // Conversions read left to right in the direction the money moved. Each
  // side stays whole, so on a narrow phone the figure breaks at the arrow.
  const amountParts = (
    entry.kind === 'deposit'
      ? [assets, shares]
      : entry.kind === 'redemption-processed'
        ? [shares, assets]
        : entry.kind === 'proceeds-claimed'
          ? [assets]
          : [shares]
  ).filter((part): part is string => part !== null);

  return (
    <li className="flex items-start justify-between gap-4 border-b border-subtle py-3 first:pt-0 last:border-b-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-small font-medium text-primary">
          {entry.unresolved ? (
            <TextSkeleton className="w-24" />
          ) : explorer ? (
            <NextLink
              href={`${explorer}/tx/${entry.txHash}`}
              target="_blank"
              className="inline-flex items-center gap-1 hover:underline"
            >
              {LABELS[entry.kind]}
              <ExternalLinkIcon aria-hidden="true" className="size-3.5 text-tertiary" />
              <span className="sr-only">(opens the transaction in a new tab)</span>
            </NextLink>
          ) : (
            LABELS[entry.kind]
          )}
        </p>
        {/* The chain and date never wrap; on a narrow phone a two-amount figure breaks at its arrow instead. */}
        <p className="flex items-center gap-1.5 text-extraSmall whitespace-nowrap text-secondary">
          <Icon className="size-4 rounded-full" />
          {chainLabel}
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(entry.timestampMs).toISOString()}>{formatDayLabel(entry.timestampMs)}</time>
        </p>
      </div>
      <p className="text-right text-small text-primary tabular-nums">
        {amountParts.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && ' → '}
            <span className="whitespace-nowrap">{part}</span>
          </Fragment>
        ))}
      </p>
    </li>
  );
}
