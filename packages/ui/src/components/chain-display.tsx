import { type ComponentType } from 'react';

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
} from '../icons';
import { type IconProps } from '../icons/types';

export type ChainDisplay = { label: string; Icon: ComponentType<IconProps> };

/**
 * Chain branding per spoke chain — a testnet chain advertises its mainnet
 * family. The one map behind every "available networks" surface in the dApp
 * and the landing, so a new chain is named and drawn in exactly one place.
 * Keyed by plain chain ids on purpose: the design system knows nothing about
 * the indexer, and each consumer indexes it with its own chain union, so a
 * chain added there without an entry here fails that consumer's typecheck.
 */
export const CHAIN_DISPLAY = {
  ethereum: { label: 'Ethereum', Icon: EthereumIcon },
  sepolia: { label: 'Ethereum', Icon: EthereumIcon },
  pharos: { label: 'Pharos', Icon: PharosIcon },
  base: { label: 'Base', Icon: BaseIcon },
  arbitrum: { label: 'Arbitrum', Icon: ArbitrumIcon },
  avalanche: { label: 'Avalanche', Icon: AvalancheIcon },
  optimism: { label: 'Optimism', Icon: OptimismIcon },
  hyperliquid: { label: 'Hyperliquid', Icon: HyperliquidIcon },
  xlayer: { label: 'X Layer', Icon: XLayerIcon },
  bnb: { label: 'BNB Chain', Icon: BnbIcon },
  monad: { label: 'Monad', Icon: MonadIcon },
  'base-sepolia': { label: 'Base', Icon: BaseIcon }
} satisfies Record<string, ChainDisplay>;
