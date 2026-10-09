'use client';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { Skeleton } from '@zivoe/ui/core/skeleton';

import TextSkeleton from '@/components/text-skeleton';
import { getTokenInfo } from '@/components/token-info';

import { type Portfolio, type TokenHolding } from '@/portfolio';
import { chainNames } from '@/zivoe-vaults/chain-display';

import { AmountBlock } from './amount-block';
import { failedReadsLabel } from './format';
import { TokenNetworksDialog } from './token-networks-dialog';

/**
 * Every coin the wallet holds or has in flight, across all networks. The
 * balance is what the wallet holds; the lines under it say what of that
 * coin is in redemption or ready to claim, and the rows' values add up to
 * the hero's total to the cent. Rows appear once every chain has
 * answered (or the settle window has run out) — never a figure that grows
 * as chains land.
 */
export function Tokens({
  portfolio,
  isHolding,
  refetch,
  isRefetching
}: {
  portfolio: Portfolio;
  /** Inside the settle window: skeleton rows, no partial figures. */
  isHolding: boolean;
  refetch: () => void;
  isRefetching: boolean;
}) {
  const { chains, tokens, pendingChains, failedChains } = portfolio;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tokens</CardTitle>
      </CardHeader>

      <CardContent className="gap-3">
        {/* The rows mix balance and position reads (the in-flight lines), so a failure of either is named here. */}
        {failedChains.length > 0 && (
          <Callout variant="warning">
            {failedChains.length === chains.length
              ? `Could not load your ${failedReadsLabel(portfolio)}.`
              : `Could not load ${failedReadsLabel(portfolio)} on ${chainNames(failedChains)}; the figures there may be incomplete.`}{' '}
            <Button variant="link-primary" size="s" onPress={refetch} isDisabled={isRefetching}>
              Retry
            </Button>
          </Callout>
        )}

        {isHolding ? (
          <TokensSkeletonRows />
        ) : tokens.length === 0 ? (
          failedChains.length === 0 && (
            <p className="py-6 text-center text-small text-secondary">
              No holdings yet. Deposit into the vault to see your tokens here.
            </p>
          )
        ) : (
          <ul className="@container flex flex-col">
            <ColumnLabels />
            {tokens.map((token) => (
              <TokenRow key={token.symbol} token={token} />
            ))}
          </ul>
        )}

        {/* Past the window only: the chains that have not answered yet, so the figures above read as partial. */}
        {!isHolding && pendingChains.length > 0 && (
          <p aria-live="polite" className="text-extraSmall text-secondary">
            Still checking {chainNames(pendingChains)}…
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Rows lay out by the card's own width, not the viewport's: the three-column
 * table only from 42rem of card, below that the phone layout (asset left,
 * figures right, networks on a second line). The networks column never
 * shrinks under the widest networks button, so it cannot run into the figures.
 */
const COLUMNS = '@2xl:grid-cols-[minmax(0,1.3fr)_minmax(12.5rem,1fr)_minmax(0,1fr)]';
const ROW_CLASSES = `grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 border-b border-subtle py-4 last:border-b-0 @2xl:items-center ${COLUMNS}`;

function ColumnLabels() {
  return (
    <li
      aria-hidden="true"
      className={`hidden gap-4 border-b border-subtle pb-2 text-extraSmall tracking-wide text-tertiary uppercase @2xl:grid ${COLUMNS}`}
    >
      <span>Asset</span>
      <span>Networks</span>
      <span className="text-right">Balance</span>
    </li>
  );
}

/** Two rows shaped like TokenRow: logo and name, a network stack, the figures on the right. */
export function TokensSkeletonRows() {
  return (
    <ul aria-busy="true" aria-label="Loading tokens" className="@container flex flex-col">
      <ColumnLabels />
      {Array.from({ length: 2 }, (_, index) => (
        <li key={index} className={ROW_CLASSES}>
          {/* Each pulse sits inside the text line it stands in for, so the rows keep the loaded rows' height and spacing. */}
          <div className="flex items-center gap-3">
            <Skeleton className="size-7 shrink-0 rounded-full" />
            <div className="flex flex-col">
              <p className="text-regular">
                <TextSkeleton className="w-14" />
              </p>
              <p className="text-extraSmall">
                <TextSkeleton className="w-28" />
              </p>
            </div>
          </div>
          <div className="col-span-2 row-start-2 flex items-center gap-2 @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1">
            <span className="flex -space-x-1">
              {Array.from({ length: 4 }, (_, logo) => (
                <Skeleton key={logo} className="size-5 rounded-full ring-2 ring-neutral-0" />
              ))}
            </span>
            <Skeleton className="h-3 w-20 rounded-sm" />
          </div>
          <div className="col-start-2 row-start-1 flex flex-col items-end text-right @2xl:col-start-3">
            <p className="text-regular">
              <TextSkeleton className="w-24" />
            </p>
            <p className="text-small">
              <TextSkeleton className="w-14" />
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** The whole card while the page's data is on its way. */
export function TokensSkeleton() {
  return (
    <Card aria-hidden="true">
      <CardHeader>
        <CardTitle>Tokens</CardTitle>
      </CardHeader>
      <CardContent className="gap-3">
        <TokensSkeletonRows />
      </CardContent>
    </Card>
  );
}

function TokenRow({ token }: { token: TokenHolding }) {
  const info = getTokenInfo(token.symbol);

  return (
    <li className={ROW_CLASSES}>
      <div className="flex items-center gap-3 [&_svg]:size-7">
        {info?.icon}
        <div className="flex min-w-0 flex-col">
          <p className="text-regular font-medium text-primary">{token.symbol}</p>
          {info && <p className="truncate text-extraSmall text-secondary">{info.description}</p>}
        </div>
      </div>

      {/* On phones the networks button gets the whole second row; the figures keep the top-right corner. */}
      <div className="col-span-2 row-start-2 @2xl:col-span-1 @2xl:col-start-2 @2xl:row-start-1">
        <TokenNetworksDialog token={token} />
      </div>

      <div className="col-start-2 row-start-1 @2xl:col-start-3">
        <AmountBlock amounts={token} symbol={token.symbol} valueD18={token.valueD18} />
      </div>
    </li>
  );
}
