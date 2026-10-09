'use client';

import { useMemo } from 'react';

import { type Address } from 'viem';

import { useTokenBalanceQueries } from '@/hooks/useBalance';
import { useCurrentShareMetrics } from '@/hooks/useCurrentShareMetrics';
import { readState, useSettleWindow } from '@/hooks/useSettleWindow';

import { type TransactionIdentity, useRedemptionPositions } from '@/centrifuge';

import { type Portfolio, buildPortfolio, portfolioTokens, tokenKey, vaultKey } from './positions';

/**
 * A wallet's position across every Centrifuge vault of a Zivoe Vault: the
 * same balance and Redemption Position queries the vault page runs, under
 * the same cache keys, folded into one model. `accountAddress` is the
 * wallet to read; the page decides whether that is the connected one.
 */
export function usePortfolio({
  identities,
  accountAddress
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  accountAddress: Address;
}): {
  portfolio: Portfolio;
  /** Inside the settle window with chains still reading: the cards show skeletons, not figures that grow chain by chain. */
  isHolding: boolean;
  sharePrice: bigint | undefined;
  refetch: () => void;
  isRefetching: boolean;
} {
  const tokens = useMemo(() => portfolioTokens(identities), [identities]);
  const shareClassKey = identities[0]!.centrifugeVault.shareClass.key;

  const balances = useTokenBalanceQueries({
    tokens: tokens.map((token) => ({ chain: token.chain, tokenAddress: token.address })),
    accountAddress
  });
  const positions = useRedemptionPositions({
    centrifugeVaults: identities.map((identity) => identity.centrifugeVault),
    accountAddress
  });
  const metrics = useCurrentShareMetrics({ shareClassKey });
  // The last answered price stays in use when a later poll fails: the query
  // keeps its data through an error, and a stale price beats a blank page.
  const sharePrice = metrics.data ? BigInt(metrics.data.sharePriceD18) : undefined;

  const portfolio = buildPortfolio({
    identities: identities,
    balances: new Map(tokens.map((token, index) => [tokenKey(token), readState(balances[index]!)])),
    positions: new Map(identities.map((identity, index) => [vaultKey(identity), readState(positions[index]!)])),
    sharePrice,
    isPriceFailed: metrics.isError && !metrics.data
  });
  // One answer for the whole page: no card prints until every chain has answered or the window has run out.
  const isHolding = useSettleWindow({ isPending: portfolio.pendingChains.length > 0 });

  return {
    portfolio,
    isHolding,
    sharePrice,
    refetch: () => {
      for (const read of [...balances, ...positions]) void read.refetch();
      void metrics.refetch();
    },
    isRefetching: [...balances, ...positions].some((read) => read.isFetching) || metrics.isFetching
  };
}
