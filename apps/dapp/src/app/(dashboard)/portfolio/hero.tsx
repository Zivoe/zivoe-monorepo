'use client';

import { type Address } from 'viem';

import { Button } from '@zivoe/ui/core/button';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { formatUsdD18, truncateAddress } from '@/lib/utils';

import Container from '@/components/container';
import { HeroAsset } from '@/components/hero/asset';
import TextSkeleton from '@/components/text-skeleton';

import { type Portfolio } from '@/portfolio';
import { chainNames } from '@/zivoe-vaults/chain-display';

import { failedReadsLabel } from './format';

const HERO_CLASSES = {
  root: 'relative overflow-hidden bg-element-primary text-base',
  container: 'relative z-10 gap-6 py-10 lg:py-14',
  title: 'flex flex-wrap items-center gap-3 text-regular lg:text-leading',
  total: 'font-heading! text-h3 lg:text-h1',
  status: 'min-h-5'
};

/**
 * The page's header: the wallet's total across every network, every coin
 * and wherever the money sits — in the wallet, in a redemption queue, ready
 * to claim. The cards below break it down; this is the one figure.
 */
export function PortfolioHero({
  address,
  isPreview,
  portfolio,
  isHolding,
  refetch,
  isRefetching
}: {
  address: Address;
  isPreview: boolean;
  portfolio: Portfolio;
  /** Inside the settle window: the figure pulses and no chain is named yet. */
  isHolding: boolean;
  refetch: () => void;
  isRefetching: boolean;
}) {
  const { chains, totalD18, pendingChains, failedChains, isPriceFailed } = portfolio;
  // Nothing honest to print: the price is missing, or every chain failed. One failed chain is left out instead.
  const everyChainFailed = failedChains.length > 0 && failedChains.length === chains.length;
  const unavailable = isPriceFailed || everyChainFailed;

  return (
    <div className={HERO_CLASSES.root}>
      <Container className={HERO_CLASSES.container}>
        <div className="flex flex-col gap-2">
          <h1 className={HERO_CLASSES.title}>
            {isPreview ? 'Portfolio preview' : 'My Portfolio'}
            <span aria-hidden="true" className="opacity-50">
              |
            </span>
            <span className="font-mono text-small opacity-80" title={address}>
              {truncateAddress(address)}
            </span>
          </h1>
          <p className={HERO_CLASSES.total}>
            {totalD18 !== null ? (
              formatUsdD18(totalD18)
            ) : unavailable ? (
              '—'
            ) : (
              <TextSkeleton className="w-40 bg-neutral-0/15 lg:w-56" />
            )}
          </p>
        </div>

        {/* What the total is still waiting on, or why it cannot be shown. Always one line tall, so nothing below jumps when it clears. */}
        <div className={HERO_CLASSES.status}>
          {failedChains.length > 0 ? (
            <p role="status" className="text-small">
              {/* Every chain failing at once is one outage (the indexer every vault resolves through), not eleven. */}
              {everyChainFailed
                ? `Could not load your ${failedReadsLabel(portfolio)}.`
                : `Could not load ${chainNames(failedChains)}; this figure leaves ${failedChains.length === 1 ? 'it' : 'them'} out.`}{' '}
              <Button variant="link-base" size="s" onPress={refetch} isDisabled={isRefetching} className="underline">
                Retry
              </Button>
            </p>
          ) : isPriceFailed ? (
            <p role="status" className="text-small">
              Share price unavailable.{' '}
              <Button variant="link-base" size="s" onPress={refetch} isDisabled={isRefetching} className="underline">
                Retry
              </Button>
            </p>
          ) : pendingChains.length > 0 && !isHolding ? (
            <p role="status" aria-live="polite" className="text-small opacity-80">
              Still checking {chainNames(pendingChains)}…
            </p>
          ) : null}
        </div>
      </Container>

      <HeroAsset className="absolute right-0 bottom-0 hidden lg:block" />
    </div>
  );
}

/**
 * The hero while the page's data is on its way: the same elements with the
 * same type sizes, the figure a pulse, so the header is exactly as tall as
 * the one that replaces it and nothing below it moves.
 */
export function PortfolioHeroSkeleton() {
  const pulse = 'bg-neutral-0/15';
  return (
    <div className={HERO_CLASSES.root}>
      <Container className={HERO_CLASSES.container}>
        <div className="flex flex-col gap-2">
          <p className={HERO_CLASSES.title}>
            <span>
              <TextSkeleton className={cn('w-40', pulse)} />
            </span>
          </p>
          <p className={HERO_CLASSES.total}>
            <TextSkeleton className={cn('w-40 lg:w-56', pulse)} />
          </p>
        </div>

        <div className={HERO_CLASSES.status} />
      </Container>

      <HeroAsset className="absolute right-0 bottom-0 hidden lg:block" />
    </div>
  );
}
