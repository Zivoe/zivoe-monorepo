'use client';

import { type ComponentType, type ReactNode } from 'react';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { Tooltip, TooltipFocusable, TooltipTrigger } from '@zivoe/ui/core/tooltip';
import {
  ArbitrumIcon,
  AvalancheIcon,
  BaseIcon,
  BnbIcon,
  EthereumIcon,
  HyperliquidIcon,
  MonadIcon,
  OptimismIcon,
  PharosIcon,
  XLayerIcon
} from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

const chainDisplay: Record<CentrifugeChain, { label: string; Icon: ComponentType<IconProps> }> = {
  ethereum: { label: 'Ethereum', Icon: EthereumIcon },
  sepolia: { label: 'Ethereum Sepolia', Icon: EthereumIcon },
  pharos: { label: 'Pharos', Icon: PharosIcon },
  base: { label: 'Base', Icon: BaseIcon },
  'base-sepolia': { label: 'Base Sepolia', Icon: BaseIcon },
  arbitrum: { label: 'Arbitrum', Icon: ArbitrumIcon },
  avalanche: { label: 'Avalanche', Icon: AvalancheIcon },
  optimism: { label: 'Optimism', Icon: OptimismIcon },
  hyperliquid: { label: 'Hyperliquid', Icon: HyperliquidIcon },
  xlayer: { label: 'X Layer', Icon: XLayerIcon },
  bnb: { label: 'BNB Chain', Icon: BnbIcon },
  monad: { label: 'Monad', Icon: MonadIcon }
};

export function MetricLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex w-fit max-w-full shrink-0 items-center gap-1 rounded-sm text-brand underline decoration-primary-900/40 underline-offset-4 transition-colors hover:text-primary hover:decoration-primary-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-900"
    >
      <span className="min-w-0">{children}</span>
      <span aria-hidden="true">↗</span>
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}

export function AvailableNetworks({ chains }: { chains: Array<CentrifugeChain> }) {
  return (
    <div className="grid gap-1.5 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.625rem] leading-4 tracking-wide uppercase">
        <MetricLink href="https://app.zivoe.com">App</MetricLink>
        <span aria-hidden="true" className="hidden text-primary/30 sm:inline">
          |
        </span>
        <span className="whitespace-nowrap text-primary/65">Available on</span>
      </div>
      <div
        role="group"
        aria-label="Available networks"
        className="flex min-w-0 flex-wrap items-center -space-x-1.5 gap-y-1 pl-1.5 lg:flex-nowrap"
      >
        {chains.map((chain) => {
          const { label, Icon } = chainDisplay[chain];
          return (
            <TooltipTrigger key={chain}>
              <TooltipFocusable>
                <span
                  role="img"
                  aria-label={label}
                  title={label}
                  className="relative rounded-full ring-2 ring-neutral-0 outline-hidden hover:z-10 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-900"
                >
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>
              </TooltipFocusable>
              <Tooltip>{label}</Tooltip>
            </TooltipTrigger>
          );
        })}
      </div>
    </div>
  );
}
