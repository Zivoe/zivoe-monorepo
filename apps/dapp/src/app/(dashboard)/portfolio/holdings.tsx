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
      <p>
        {hasAvailable ? (
          <>
            <span className="font-bold text-primary">{amount(row.available)}</span> {row.asset}
            {availableKnown ? '' : ' (partial)'}
          </>
        ) : (
          'Balance unavailable'
        )}
      </p>
      {row.pending > 0n && (
        <p className="text-extraSmall text-secondary">
          <span className="font-bold text-primary">{amount(row.pending)}</span> {row.asset} pending
        </p>
      )}
      {row.claimable > 0n && (
        <p className="text-extraSmall text-secondary">
          <span className="font-bold text-primary">{amount(row.claimable)}</span> {row.asset} claimable
        </p>
      )}
      {!requestsKnown && <p className="text-extraSmall text-secondary">Requests incomplete · view chains</p>}
      {stale && <p className="text-extraSmall text-secondary">Last known amounts · view chains</p>}
    </div>
  );
}
export function Holdings({ model }: { model: PortfolioModel }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedRow = model.holdings.find((row) => row.asset === selected);
  return (
    <Card title="Holdings" className="order-2">
      <div className="hidden overflow-x-auto rounded-lg md:block">
        <table className="w-full table-fixed text-left text-small leading-5">
          <colgroup>
            <col className="w-1/3" />
            <col className="w-1/3" />
            <col className="w-1/3" />
          </colgroup>
          <thead className="text-extraSmall text-secondary">
            <tr>
              {['Asset', 'Balance', 'Value'].map((label) => (
                <th key={label} scope="col" className="px-3 pb-2 text-left font-normal">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {model.holdings.map((row) => (
              <tr key={row.asset} className="border-t border-default odd:bg-surface-base even:bg-surface-elevated">
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
                <td className="px-3 py-2">
                  <Balances row={row} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-primary tabular-nums">{money(row.valueD18)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-element-primary-gentle text-primary">
            <tr>
              <th scope="row" colSpan={2} className="py-2.5 pl-3 font-medium">
                <span className="sr-only">Total value</span>
              </th>
              <td className="px-3 py-2.5 font-bold whitespace-nowrap tabular-nums">{money(model.totalD18)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="divide-y divide-default overflow-hidden rounded-lg md:hidden">
        {model.holdings.map((row) => (
          <div className="px-3 py-2.5 odd:bg-surface-base even:bg-surface-elevated" key={row.asset}>
            <div className="flex items-center justify-between gap-2">
              <Asset asset={row.asset} />
              <p className="text-small leading-5 text-primary tabular-nums">{money(row.valueD18)}</p>
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
        <dl className="flex items-center justify-between gap-3 bg-element-primary-gentle px-3 py-2.5 text-small leading-5 text-primary tabular-nums">
          <dt className="sr-only">Total value</dt>
          <dd className="ml-auto font-bold whitespace-nowrap">{money(model.totalD18)}</dd>
        </dl>
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

export function Allocation({ model }: { model: PortfolioModel }) {
  const [hoveredAsset, setHoveredAsset] = useState<AssetHolding['asset'] | null>(null);
  const [focusedAsset, setFocusedAsset] = useState<AssetHolding['asset'] | null>(null);
  const hasAllocation = model.complete && model.totalD18 !== null && model.totalD18 > 0n;
  const activeAsset = hasAllocation ? (hoveredAsset ?? focusedAsset) : null;
  const activeHolding = model.holdings.find((row) => row.asset === activeAsset);
  let offset = 0;
  return (
    <Card title="Allocation" className="order-3">
      <div className="flex flex-wrap items-center justify-center gap-8">
        <div className="relative size-40 shrink-0">
          <svg
            viewBox="0 0 120 120"
            className="size-full -rotate-90"
            role="img"
            aria-label={
              model.complete
                ? 'Portfolio allocation by asset; percentages listed alongside'
                : 'Allocation unavailable until all balances load'
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
                    onMouseEnter={() => setHoveredAsset(row.asset)}
                    onMouseLeave={() => setHoveredAsset(null)}
                  />
                );
              })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-extraSmall text-secondary">{activeHolding?.asset ?? 'Total value'}</span>
            <span className="text-small font-medium">{money(activeHolding?.valueD18 ?? model.totalD18)}</span>
          </div>
        </div>
        <ul className="min-w-36 flex-1 space-y-1">
          {model.holdings.map((row) => (
            <li key={row.asset}>
              <Button
                variant="ghost-light"
                size="s"
                fullWidth
                isDisabled={!hasAllocation || !row.valueD18}
                aria-label={`Highlight ${row.asset} allocation: ${money(row.valueD18)}`}
                onHoverStart={() => setHoveredAsset(row.asset)}
                onHoverEnd={() => setHoveredAsset(null)}
                onFocus={() => setFocusedAsset(row.asset)}
                onBlur={() => setFocusedAsset(null)}
                onPress={() => setFocusedAsset(row.asset)}
                className={cn(
                  'h-auto justify-start gap-2 rounded-md px-2 py-1.5 text-small font-normal text-primary transition-opacity duration-150 disabled:bg-transparent disabled:text-primary motion-reduce:transition-none [&_svg]:size-5',
                  activeAsset === row.asset && 'bg-element-primary-light',
                  activeAsset && activeAsset !== row.asset && 'opacity-40'
                )}
              >
                <span aria-hidden="true" className="size-5 shrink-0 [&>svg]:size-full">
                  {getTokenInfo(row.asset)?.icon}
                </span>
                <span>{row.asset}</span>
                <span className="ml-auto text-secondary">
                  {row.sharePercent === null ? '—' : `${row.sharePercent.toFixed(1)}%`}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </div>
      {!model.complete && (
        <p className="mt-4 text-extraSmall text-secondary">
          Allocation appears once all required balances and prices are available.
        </p>
      )}
    </Card>
  );
}
