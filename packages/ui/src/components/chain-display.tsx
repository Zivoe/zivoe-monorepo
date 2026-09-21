import { type ComponentType } from 'react';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

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

/**
 * Chain branding per spoke chain — a testnet chain advertises its mainnet
 * family. The one map behind every "available networks" surface in the dApp
 * and the landing, so a new chain is named and drawn in exactly one place.
 */
export const CHAIN_DISPLAY: Record<CentrifugeChain, { label: string; Icon: ComponentType<IconProps> }> = {
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
};
