'use client';

import { type Address } from 'viem';

import { Button } from '@zivoe/ui/core/button';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { formatUsdD18, truncateAddress } from '@/lib/utils';

import Container from '@/components/container';
import { HeroAsset } from '@/components/hero/asset';
import TextSkeleton from '@/components/text-skeleton';
import { getTokenInfo } from '@/components/token-info';

import { type Portfolio } from '@/portfolio';
import { chainNames } from '@/zivoe-vaults/chain-display';

import { failedReadsLabel } from './format';

/** The three places money can be, in the order the hero and its skeleton print them. */
const BUCKETS = [
  { key: 'wallet', label: 'In your wallet', note: 'Available right now' },
  { key: 'inRedemption', label: 'In redemption', note: 'Requests and approvals in progress' },
  { key: 'readyToClaim', label: 'Ready to claim', note: 'Claimable in the vault' }
] as const;

const HERO_CLASSES = {
  root: 'relative overflow-hidden bg-element-primary text-base',
  container: 'relative z-10 gap-6 py-10 lg:py-14',
  title: 'flex flex-wrap items-center gap-3 text-regular lg:text-leading',
  total: 'font-heading! text-h3 lg:text-h1',
  families: 'flex flex-wrap gap-x-10 gap-y-4',
  familyLabel: 'flex items-center gap-2 text-small [&_svg]:size-5',
  familyValue: 'mt-1 text-leading',
  buckets: 'grid w-full max-w-3xl gap-px overflow-hidden rounded-lg bg-neutral-0/10 sm:grid-cols-3',
  bucket: 'bg-element-primary/70 px-4 py-3',
  bucketLabel: 'text-small opacity-80',
  bucketValue: 'mt-1 font-heading! text-h6',
  bucketNote: 'mt-0.5 text-extraSmall opacity-70',
  status: 'min-h-5'
};

/**
 * The page's header: the wallet's total across every network, split by
 * token family and by where the money is. Every figure here comes from the
 * one model, so the buckets always add up to the total to the cent.
 */
export function PortfolioHero({
  address,
  isPreview,
  portfolio,
  isHolding,
  shareSymbol,
  refetch,
  isRefetching
}: {
  address: Address;
  isPreview: boolean;
  portfolio: Portfolio;
  /** Inside the settle window: the figures pulse and no chain is named yet. */
  isHolding: boolean;
  shareSymbol: string;
  refetch: () => void;
  isRefetching: boolean;
}) {
  const { chains, totalD18, buckets, tokens, pendingChains, failedChains, isPriceFailed } = portfolio;
  const sumValues = (kind: 'share' | 'asset') =>
    tokens.filter((token) => token.kind === kind).reduce((acc, token) => acc + (token.valueD18 ?? 0n), 0n);
  const stablecoinIcons = tokens
    .filter((token) => token.kind === 'asset')
    .map((token) => <span key={token.symbol}>{getTokenInfo(token.symbol)?.icon}</span>);
  const families = [
    { label: shareSymbol, value: sumValues('share'), icon: getTokenInfo(shareSymbol)?.icon },
    {
      label: 'Stablecoins',
      value: sumValues('asset'),
      icon: stablecoinIcons.length > 0 ? <span className="flex -space-x-1.5">{stablecoinIcons}</span> : null
    }
  ];
  // Nothing honest to print: the price is missing, or every chain failed. One failed chain is left out instead.
  const everyChainFailed = failedChains.length > 0 && failedChains.length === chains.length;
  const unavailable = isPriceFailed || everyChainFailed;
  const bucketRows = BUCKETS.map((bucket) => ({ ...bucket, value: buckets?.[bucket.key] }));

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
            <Figure value={totalD18} failed={unavailable} skeletonClassName="w-40 lg:w-56" />
          </p>
        </div>

        <dl className={HERO_CLASSES.families}>
          {families.map(({ label, value, icon }) => (
            <div key={label}>
              <dt className={HERO_CLASSES.familyLabel}>
                {icon}
                <span className="opacity-80">{label}</span>
              </dt>
              <dd className={HERO_CLASSES.familyValue}>
                <Figure value={buckets ? value : null} failed={unavailable} skeletonClassName="w-20" />
              </dd>
            </div>
          ))}
        </dl>

        <dl className={HERO_CLASSES.buckets}>
          {bucketRows.map(({ label, value, note }) => (
            <div key={label} className={HERO_CLASSES.bucket}>
              <dt className={HERO_CLASSES.bucketLabel}>{label}</dt>
              <dd className={HERO_CLASSES.bucketValue}>
                <Figure value={value ?? null} failed={unavailable} skeletonClassName="w-24" />
              </dd>
              <dd className={HERO_CLASSES.bucketNote}>{note}</dd>
            </div>
          ))}
        </dl>

        {/* What the total is still waiting on, or why it cannot be shown. Always one line tall, so nothing below jumps when it clears. */}
        <div className={HERO_CLASSES.status}>
          {failedChains.length > 0 ? (
            <p role="status" className="text-small">
              {/* Every chain failing at once is one outage (the indexer every vault resolves through), not eleven. */}
              {everyChainFailed
                ? `Could not load your ${failedReadsLabel(portfolio)}.`
                : `Could not load ${chainNames(failedChains)}; these figures leave ${failedChains.length === 1 ? 'it' : 'them'} out.`}{' '}
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
 * same type sizes, every figure a pulse, so the header is exactly as tall
 * as the one that replaces it and nothing below it moves.
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

        <dl className={HERO_CLASSES.families}>
          {['share', 'stablecoins'].map((family) => (
            <div key={family}>
              <dt className={HERO_CLASSES.familyLabel}>
                <Skeleton className={cn('size-5 rounded-full', pulse)} />
                <TextSkeleton className={cn('w-16', pulse)} />
              </dt>
              <dd className={HERO_CLASSES.familyValue}>
                <TextSkeleton className={cn('w-20', pulse)} />
              </dd>
            </div>
          ))}
        </dl>

        <dl className={HERO_CLASSES.buckets}>
          {BUCKETS.map(({ key, label, note }) => (
            <div key={key} className={HERO_CLASSES.bucket}>
              <dt className={HERO_CLASSES.bucketLabel}>{label}</dt>
              <dd className={HERO_CLASSES.bucketValue}>
                <TextSkeleton className={cn('w-24', pulse)} />
              </dd>
              <dd className={HERO_CLASSES.bucketNote}>{note}</dd>
            </div>
          ))}
        </dl>

        <div className={HERO_CLASSES.status} />
      </Container>

      <HeroAsset className="absolute right-0 bottom-0 hidden lg:block" />
    </div>
  );
}

/** A USD figure, a pulse while it is on its way, a dash once it cannot come. */
function Figure({
  value,
  failed,
  skeletonClassName
}: {
  value: bigint | null;
  failed: boolean;
  skeletonClassName: string;
}) {
  if (value !== null) return <>{formatUsdD18(value)}</>;
  if (failed) return <>—</>;
  return <TextSkeleton className={cn('bg-neutral-0/15', skeletonClassName)} />;
}
