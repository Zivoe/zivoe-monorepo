import { useState } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { DialogContent, DialogContentBox, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { EyeIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { getTokenInfo } from '@/components/token-info';

import { type AssetHolding, type PortfolioModel } from '@/portfolio/model';

import { ChainHoldingsTable } from './chain-holdings-table';
import { Card, amount, money } from './common';

function Asset({ asset }: { asset: string }) {
  return (
    <div className="flex items-center gap-2 text-small leading-5">
      <span aria-hidden="true" className="size-5 shrink-0 [&>svg]:size-full">
        {getTokenInfo(asset)?.icon}
      </span>
      <span className="font-medium text-primary">{asset}</span>
    </div>
  );
}
function Balances({ row }: { row: AssetHolding }) {
  if (!row.supported) return <span className="text-secondary">Unsupported</span>;
  const hasAvailable = row.chains.some((chain) => chain.availableKnown);
  const availableKnown = row.chains.every((chain) => chain.availableKnown);
  const requestsKnown = row.chains.every((chain) => chain.requestsKnown);
  const stale = row.chains.some((chain) => !chain.complete && chain.availableKnown && chain.requestsKnown);
  return (
    <div className="text-small leading-5 text-secondary tabular-nums">
      <p className="text-small leading-5">
        {hasAvailable ? (
          <>
            <span className="text-primary">{amount(row.available)}</span> {row.asset}
            {availableKnown ? '' : ' (partial)'}
          </>
        ) : (
          'Balance unavailable'
        )}
      </p>
      {row.pending > 0n && (
        <p className="text-small leading-5 text-secondary">
          <span className="text-primary">{amount(row.pending)}</span> {row.asset} pending
        </p>
      )}
      {row.claimable > 0n && (
        <p className="text-small leading-5 text-secondary">
          <span className="text-primary">{amount(row.claimable)}</span> {row.asset} claimable
        </p>
      )}
      {!requestsKnown && <p className="text-extraSmall text-secondary">Requests incomplete · view chains</p>}
      {stale && <p className="text-extraSmall text-secondary">Last known amounts · view chains</p>}
    </div>
  );
}
export function Holdings({ model }: { model: PortfolioModel }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [hoveredAsset, setHoveredAsset] = useState<AssetHolding['asset'] | null>(null);
  const [focusedAsset, setFocusedAsset] = useState<AssetHolding['asset'] | null>(null);
  const hasDistribution = model.complete && model.totalD18 !== null && model.totalD18 > 0n;
  const activeAsset = hasDistribution ? (hoveredAsset ?? focusedAsset) : null;
  const selectedRow = model.holdings.find((row) => row.asset === selected);
  const distributionEvents = (row: AssetHolding) => ({
    onMouseEnter: () => setHoveredAsset(hasDistribution && row.valueD18 ? row.asset : null),
    onMouseLeave: () => setHoveredAsset(null),
    onFocusCapture: () => setFocusedAsset(hasDistribution && row.valueD18 ? row.asset : null),
    onBlurCapture: () => setFocusedAsset(null)
  });
  return (
    <Card title="Tokens" className="order-3">
      <div className="flex flex-col items-center gap-6 xl:grid xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
        <div className="flex flex-col items-center gap-3">
          <DistributionPie model={model} activeAsset={activeAsset} onHover={setHoveredAsset} />
          {!model.complete && (
            <p className="max-w-48 text-center text-extraSmall text-secondary">
              Distribution appears once all required balances and prices are available.
            </p>
          )}
        </div>
        <div className="w-full min-w-0">
          <div className="hidden overflow-x-auto rounded-lg md:block">
            <table className="w-full table-fixed text-left text-small leading-5">
              <colgroup>
                <col className="w-1/3" />
                <col className="w-1/3" />
                <col className="w-1/3" />
              </colgroup>
              <thead className="text-extraSmall text-secondary">
                <tr>
                  {['Balance', 'Asset', 'Value'].map((label) => (
                    <th key={label} scope="col" className="px-3 pb-2 text-left font-normal">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.holdings.map((row) => (
                  <tr
                    key={row.asset}
                    {...distributionEvents(row)}
                    className={cn(
                      'border-t border-default transition-opacity duration-150 odd:bg-surface-base even:bg-surface-elevated motion-reduce:transition-none',
                      activeAsset && activeAsset !== row.asset && 'opacity-40'
                    )}
                  >
                    <td className="px-3 py-2">
                      <Balances row={row} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                        <Asset asset={row.asset} />
                        <Button
                          aria-label={`View ${row.asset} chains`}
                          onPress={() => setSelected(row.asset)}
                          variant="link-primary"
                          size="xs"
                          className="min-h-6 font-normal"
                        >
                          Chains
                          <EyeIcon aria-hidden="true" focusable="false" />
                        </Button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-small leading-5 font-bold whitespace-nowrap text-primary tabular-nums">
                      {money(row.valueD18)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="divide-y divide-default overflow-hidden rounded-lg md:hidden">
            {model.holdings.map((row) => (
              <div
                key={row.asset}
                {...distributionEvents(row)}
                className={cn(
                  'px-3 py-2.5 transition-opacity duration-150 odd:bg-surface-base even:bg-surface-elevated motion-reduce:transition-none',
                  activeAsset && activeAsset !== row.asset && 'opacity-40'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Asset asset={row.asset} />
                  <p className="text-small leading-5 font-bold text-primary tabular-nums">{money(row.valueD18)}</p>
                </div>
                <div className="mt-0.5 flex items-start justify-between gap-3 pl-7">
                  <Balances row={row} />
                  <Button
                    aria-label={`View ${row.asset} chains`}
                    onPress={() => setSelected(row.asset)}
                    variant="link-primary"
                    size="xs"
                    className="min-h-6 shrink-0 font-normal"
                  >
                    Chains
                    <EyeIcon aria-hidden="true" focusable="false" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <DialogContent
        isOpen={Boolean(selectedRow)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        className="max-w-2xl"
      >
        <DialogHeader className="pr-16">
          <DialogTitle>{selected} across chains</DialogTitle>
        </DialogHeader>
        <DialogContentBox className="min-w-0 p-4 sm:p-5">
          {selectedRow && <ChainHoldingsTable holding={selectedRow} />}
        </DialogContentBox>
      </DialogContent>
    </Card>
  );
}

const COLORS: Record<AssetHolding['asset'], string> = {
  zSMB: 'hsl(var(--secondary-700))',
  USDC: '#2775CA',
  USDT: '#26A17B',
  USD1: '#E9A400'
};

function allocationArc(start: number, share: number) {
  if (share >= 100) return 'M108 60 A48 48 0 1 1 12 60 A48 48 0 1 1 108 60';
  const from = (start / 100) * Math.PI * 2;
  const to = ((start + share) / 100) * Math.PI * 2;
  return `M${60 + 48 * Math.cos(from)} ${60 + 48 * Math.sin(from)} A48 48 0 ${share > 50 ? 1 : 0} 1 ${60 + 48 * Math.cos(to)} ${60 + 48 * Math.sin(to)}`;
}

function DistributionPie({
  model,
  activeAsset,
  onHover
}: {
  model: PortfolioModel;
  activeAsset: AssetHolding['asset'] | null;
  onHover: (asset: AssetHolding['asset'] | null) => void;
}) {
  const hasAllocation = model.complete && model.totalD18 !== null && model.totalD18 > 0n;
  const activeHolding = model.holdings.find((row) => row.asset === activeAsset);
  let offset = 0;
  return (
    <div className="relative size-40 shrink-0">
      <svg
        viewBox="0 0 120 120"
        className="size-full -rotate-90"
        role="img"
        aria-label={
          model.complete
            ? `Portfolio distribution by asset: ${model.holdings.map((row) => `${row.asset} ${(row.sharePercent ?? 0).toFixed(1)}%`).join(', ')}`
            : 'Distribution unavailable until all balances load'
        }
      >
        <circle
          cx="60"
          cy="60"
          r="48"
          fill="none"
          stroke="hsl(var(--neutral-100))"
          className="pointer-events-none"
          strokeWidth="15"
        />
        {hasAllocation &&
          model.holdings.map((row) => {
            const share = Number(((row.valueD18 ?? 0n) * 1_000_000n) / model.totalD18!) / 10000;
            const start = offset;
            offset += share;
            if (share <= 0) return null;
            return (
              <path
                key={row.asset}
                data-asset={row.asset}
                d={allocationArc(start, share)}
                fill="none"
                stroke={COLORS[row.asset]}
                strokeWidth={activeAsset === row.asset ? 18 : 15}
                opacity={activeAsset && activeAsset !== row.asset ? 0.2 : 1}
                className="cursor-pointer transition-[opacity,stroke-width] duration-150 motion-reduce:transition-none"
                onMouseEnter={() => onHover(row.asset)}
                onMouseLeave={() => onHover(null)}
              />
            );
          })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-extraSmall text-secondary">{activeHolding?.asset ?? 'Total value'}</span>
        <span className="text-small font-medium">{money(activeHolding?.valueD18 ?? model.totalD18)}</span>
      </div>
    </div>
  );
}
