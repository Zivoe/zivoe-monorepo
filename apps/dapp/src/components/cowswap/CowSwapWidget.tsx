'use client';

import { type CowSwapWidgetPalette, type CowSwapWidgetParams, TradeType } from '@cowprotocol/widget-lib';
import { CowSwapWidget } from '@cowprotocol/widget-react';
import { useDynamicContext } from '@dynamic-labs/sdk-react-core';
import { mainnet, sepolia } from 'viem/chains';

import { Button } from '@zivoe/ui/core/button';
import { Skeleton } from '@zivoe/ui/core/skeleton';

import { CONTRACTS, NETWORK } from '@/lib/constants';

import { useAccount } from '@/hooks/useAccount';

import SkeletonAction from '../skeleton-action';
import { useCowswapListeners } from './useCowswapListeners';

const DEFAULT_NETWORK = NETWORK === 'SEPOLIA' ? sepolia.id : mainnet.id;

const theme: CowSwapWidgetPalette = {
  baseTheme: 'light',
  primary: '#0A6061',
  background: '#ffffff',
  paper: '#F9FAFB',
  text: '#000000',
  warning: '#F08F48',
  danger: '#B91C1C',
  alert: '#B91C1C',
  info: '#578EBF',
  success: '#038788'
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
    disableProgressBar: false,
    hideNetworkSelector: true,
    hideLogo: true,
    sounds: {
      postOrder: null,
      orderExecuted: null,
      orderError: null
    },
    theme
  };

  if (account.isPending) return <CowSwapWidgetSkeleton />;

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

function CowSwapWidgetSkeleton() {
  return (
    <div className="flex h-[23.625rem] w-[28.125rem] flex-col gap-[10px] rounded-2xl bg-surface-elevated p-[10px] pb-[1.875rem] pt-[3rem]">
      <Skeleton className="h-[6.625rem] w-full rounded-2xl" />
      <Skeleton className="h-[6.625rem] w-full rounded-2xl" />
      <Skeleton className="h-[3.625rem] w-full rounded-2xl" />
    </div>
  );
}
