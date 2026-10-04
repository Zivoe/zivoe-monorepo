import { type Address } from 'viem';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { type RedemptionState, redemptionStates } from '@/centrifuge/redemption-states';
import { type RedemptionPosition, type TransactionIdentity } from '@/centrifuge/types';

export const PORTFOLIO_ASSETS = ['zSMB', 'USDC', 'USDT', 'USD1'] as const;
export type PortfolioAsset = (typeof PORTFOLIO_ASSETS)[number];
export type ReadState<T> = { data?: T; isError: boolean; isPending: boolean };
export type PortfolioToken = {
  asset: PortfolioAsset;
  chain: CentrifugeChain;
  chainId: number;
  tokenAddress: Address;
  decimals: number;
};
export type Amounts = { available: bigint; pending: bigint; claimable: bigint };
export type ChainHolding = Amounts & {
  chain: CentrifugeChain;
  complete: boolean;
  availableKnown: boolean;
  requestsKnown: boolean;
  valueD18: bigint | null;
};
export type AssetHolding = Amounts & {
  asset: PortfolioAsset;
  chains: Array<ChainHolding>;
  supported: boolean;
  complete: boolean;
  valueD18: bigint | null;
  sharePercent: number | null;
};
export type PortfolioRequest = RedemptionState & {
  id: string;
  identity: TransactionIdentity;
  symbol: string;
  decimals: number;
  valueD18: bigint | null;
  stale: boolean;
};
export type PortfolioModel = {
  holdings: Array<AssetHolding>;
  requests: Array<PortfolioRequest>;
  totalD18: bigint | null;
  subtotals: Amounts | null;
  complete: boolean;
  requestsComplete: boolean;
  pendingChains: Array<CentrifugeChain>;
  failedChains: Array<CentrifugeChain>;
  unpricedAssets: Array<string>;
  priceUnavailable: boolean;
  requestPendingChains: Array<CentrifugeChain>;
  requestFailedChains: Array<CentrifugeChain>;
};
const D18 = 10n ** 18n;
export const toD18 = (amount: bigint, decimals: number) => (amount * D18) / 10n ** BigInt(decimals);
export const tokenKey = (token: Pick<PortfolioToken, 'chain' | 'tokenAddress'>) =>
  `${token.chain}:${token.tokenAddress.toLowerCase()}`;
export const positionKey = (identity: TransactionIdentity) =>
  `${identity.centrifugeVault.chain}:${identity.centrifugeVault.address.toLowerCase()}`;
export function uniqueIdentities(identities: ReadonlyArray<TransactionIdentity>) {
  return [...new Map(identities.map((identity) => [positionKey(identity), identity])).values()];
}
export function portfolioTokens(identities: ReadonlyArray<TransactionIdentity>): Array<PortfolioToken> {
  const tokens = new Map<string, PortfolioToken>();
  for (const { centrifugeVault: vault } of identities) {
    const share: PortfolioToken = {
      asset: 'zSMB',
      chain: vault.chain,
      chainId: vault.chainId,
      tokenAddress: vault.shareClass.shareTokenAddress,
      decimals: vault.shareClass.decimals
    };
    tokens.set(tokenKey(share), share);
    if (PORTFOLIO_ASSETS.some((asset) => asset === vault.asset.symbol)) {
      const token: PortfolioToken = {
        asset: vault.asset.symbol as PortfolioAsset,
        chain: vault.chain,
        chainId: vault.chainId,
        tokenAddress: vault.asset.address,
        decimals: vault.asset.decimals
      };
      tokens.set(tokenKey(token), token);
    }
  }
  return [...tokens.values()];
}
const emptyAmounts = (): Amounts => ({ available: 0n, pending: 0n, claimable: 0n });
const sumAmounts = (amounts: Amounts) => amounts.available + amounts.pending + amounts.claimable;
const readComplete = <T>(read: ReadState<T> | undefined) =>
  read?.data !== undefined && !read.isError && !read.isPending;

/** Amounts use 18-decimal normalized token units; valuation remains integer USD units throughout. */
export function buildPortfolio({
  identities: suppliedIdentities,
  balances,
  positions,
  sharePrice
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  balances: ReadonlyMap<string, ReadState<bigint>>;
  positions: ReadonlyMap<string, ReadState<RedemptionPosition>>;
  sharePrice: ReadState<bigint>;
}): PortfolioModel {
  const identities = uniqueIdentities(suppliedIdentities);
  const tokens = portfolioTokens(identities);
  const pendingChains = new Set<CentrifugeChain>();
  const failedChains = new Set<CentrifugeChain>();
  const unpricedAssets = new Set<string>();
  const requestPendingChains = new Set<CentrifugeChain>();
  const requestFailedChains = new Set<CentrifugeChain>();
  const rows = new Map<PortfolioAsset, Map<CentrifugeChain, ChainHolding>>(
    PORTFOLIO_ASSETS.map((asset) => [asset, new Map()])
  );
  const chainRow = (asset: PortfolioAsset, chain: CentrifugeChain) => {
    const chains = rows.get(asset)!;
    let row = chains.get(chain);
    if (!row) {
      row = { chain, ...emptyAmounts(), complete: true, availableKnown: true, requestsKnown: true, valueD18: null };
      chains.set(chain, row);
    }
    return row;
  };
  const markRead = <T>(chain: CentrifugeChain, read: ReadState<T> | undefined) => {
    if (read?.isError) failedChains.add(chain);
    else if (!readComplete(read)) pendingChains.add(chain);
  };
  for (const token of tokens) {
    const read = balances.get(tokenKey(token));
    const row = chainRow(token.asset, token.chain);
    row.available += toD18(read?.data ?? 0n, token.decimals);
    row.availableKnown &&= read?.data !== undefined;
    row.complete &&= readComplete(read);
    markRead(token.chain, read);
  }
  const requests: Array<PortfolioRequest> = [];
  let requestsComplete = true;
  for (const identity of identities) {
    const vault = identity.centrifugeVault;
    const read = positions.get(positionKey(identity));
    const complete = readComplete(read);
    requestsComplete &&= complete;
    if (read?.isError) requestFailedChains.add(vault.chain);
    else if (!complete) requestPendingChains.add(vault.chain);
    markRead(vault.chain, read);
    const shareRow = chainRow('zSMB', vault.chain);
    shareRow.complete &&= complete;
    shareRow.requestsKnown &&= read?.data !== undefined;
    const asset = PORTFOLIO_ASSETS.find((asset) => asset === vault.asset.symbol);
    const assetRow = asset ? chainRow(asset, vault.chain) : undefined;
    if (assetRow) {
      assetRow.complete &&= complete;
      assetRow.requestsKnown &&= read?.data !== undefined;
    }
    // EURC and future assets never inherit the dollar-stablecoin assumption.
    if (!asset && ((read?.data?.claimableRedeemAssets ?? 0n) > 0n || (read?.data?.unfundedClaimableAssets ?? 0n) > 0n))
      unpricedAssets.add(vault.asset.symbol);
    for (const state of redemptionStates(read?.data)) {
      const isShares = state.denomination === 'shares';
      const decimals = isShares ? vault.shareClass.decimals : vault.asset.decimals;
      const normalized = toD18(state.amount, decimals);
      const row = isShares ? shareRow : assetRow;
      if (row) row[state.kind === 'returned' || state.kind === 'claimable' ? 'claimable' : 'pending'] += normalized;
      const valueD18 = isShares
        ? readComplete(sharePrice)
          ? (normalized * sharePrice.data!) / D18
          : null
        : asset
          ? normalized
          : null;
      requests.push({
        ...state,
        id: `${positionKey(identity)}:${state.kind}`,
        identity,
        decimals,
        symbol: isShares ? 'zSMB' : vault.asset.symbol,
        valueD18,
        stale: !complete
      });
    }
  }
  const holdings: Array<AssetHolding> = PORTFOLIO_ASSETS.map((asset) => {
    const chains = [...rows.get(asset)!.values()];
    const priced = asset !== 'zSMB' || readComplete(sharePrice);
    for (const row of chains)
      row.valueD18 = priced ? (sumAmounts(row) * (asset === 'zSMB' ? sharePrice.data! : D18)) / D18 : null;
    const amounts = chains.reduce(
      (sum, row) => ({
        available: sum.available + row.available,
        pending: sum.pending + row.pending,
        claimable: sum.claimable + row.claimable
      }),
      emptyAmounts()
    );
    const complete = chains.every((row) => row.complete) && priced;
    return {
      asset,
      ...amounts,
      chains,
      supported: chains.length > 0,
      complete,
      valueD18: complete && chains.length > 0 ? chains.reduce((sum, row) => sum + row.valueD18!, 0n) : null,
      sharePercent: null
    };
  });
  const complete =
    tokens.length > 0 &&
    requestsComplete &&
    holdings.filter((row) => row.supported).every((row) => row.complete) &&
    unpricedAssets.size === 0;
  const totalD18 = complete ? holdings.reduce((sum, row) => sum + (row.valueD18 ?? 0n), 0n) : null;
  const subtotals = complete
    ? holdings.reduce((sum, row) => {
        const price = row.asset === 'zSMB' ? sharePrice.data! : D18;
        return {
          available: sum.available + (row.available * price) / D18,
          pending: sum.pending + (row.pending * price) / D18,
          claimable: sum.claimable + (row.claimable * price) / D18
        };
      }, emptyAmounts())
    : null;
  // Derive the headline from the same three buckets to make rounding reconcile exactly.
  const reconciledTotal = subtotals ? sumAmounts(subtotals) : totalD18;
  for (const row of holdings) {
    if (row.valueD18 !== null) {
      const price = row.asset === 'zSMB' ? sharePrice.data! : D18;
      row.valueD18 = (row.available * price) / D18 + (row.pending * price) / D18 + (row.claimable * price) / D18;
    }
    row.sharePercent =
      reconciledTotal !== null && row.supported
        ? reconciledTotal > 0n
          ? Number(((row.valueD18 ?? 0n) * 10000n) / reconciledTotal) / 100
          : 0
        : null;
  }
  return {
    holdings,
    requests,
    totalD18: reconciledTotal,
    subtotals,
    complete,
    requestsComplete,
    pendingChains: [...pendingChains],
    failedChains: [...failedChains],
    unpricedAssets: [...unpricedAssets],
    priceUnavailable: sharePrice.isError,
    requestPendingChains: [...requestPendingChains],
    requestFailedChains: [...requestFailedChains]
  };
}
