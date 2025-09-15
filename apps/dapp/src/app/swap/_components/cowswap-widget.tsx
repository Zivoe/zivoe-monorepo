'use client';

import { type CowSwapWidgetPalette, type CowSwapWidgetParams, TradeType } from '@cowprotocol/widget-lib';
import { CowSwapWidget } from '@cowprotocol/widget-react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { mainnet, sepolia } from 'viem/chains';

import { Button } from '@zivoe/ui/core/button';

import { CONTRACTS, NETWORK } from '@/lib/constants';

import { useAccount } from '@/hooks/useAccount';

import SkeletonAction from '@/components/skeleton-action';

import { useCowswapListeners } from '../_hooks/useCowswapListeners';

const DEFAULT_NETWORK = NETWORK === 'SEPOLIA' ? sepolia.id : mainnet.id;

const theme: CowSwapWidgetPalette = {
  baseTheme: 'light',
  primary: '#10393b',
  background: '#ffffff',
  paper: '#ffffff',
  text: '#12131a',
  warning: '#CA9504',
  danger: '#DC2626',
  alert: '#CA9504',
  info: '#7BADDA',
  success: '#059669'
};

export function CowSwapTradingWidget() {
  const account = useAccount();
  const { setShowAuthFlow } = useDynamicContext();
  const { listeners } = useCowswapListeners();

  const params: CowSwapWidgetParams = {
    appCode: 'Zivoe',
    standaloneMode: false,
    chainId: DEFAULT_NETWORK,
    tradeType: TradeType.SWAP,
    enabledTradeTypes: [TradeType.SWAP],
    sell: { asset: CONTRACTS.zVLT },
    buy: { asset: CONTRACTS.USDC },
    partnerFee: undefined,
    hideOrdersTable: true,
    disableToastMessages: true,
    disableProgressBar: true,
    hideNetworkSelector: true,
    hideLogo: true,
    sounds: {
      postOrder: null,
      orderExecuted: null,
      orderError: null
    },
    theme
  };

  if (account.isPending)
    return (
      <div className="size-16">
        <video src="/loader.webm" autoPlay muted loop playsInline style={{ width: '100%', height: 'auto' }}>
          Your browser does not support the video tag.
        </video>
      </div>
    );

  if (!account.address)
    return (
      <SkeletonAction
        title="Connect Wallet to Swap"
        description="You can swap your stablecoins for zVLT"
        className="relative"
      >
        <Button onPress={() => setShowAuthFlow(true)}>Connect Wallet</Button>
      </SkeletonAction>
    );

  return (
    <div className="[&>div]:w-fit">
      <CowSwapWidget params={params} listeners={listeners} provider={window.ethereum} />
    </div>
  );
}
