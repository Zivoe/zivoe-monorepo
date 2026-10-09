import { type Address } from 'viem';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import {
  type RedemptionPosition,
  type RedemptionState,
  type TransactionIdentity,
  redemptionStates
} from '@/centrifuge';

/** One read's state as the model needs it: an answer, a failure, or neither yet. */
export type ReadState<T> = { data: T | undefined; isError: boolean };

const D18 = 10n ** 18n;
const CENT = 10n ** 16n;

/**
 * An 18-decimal USD value cut to the cent — the unit every figure on the page
 * is summed in. Truncated, not rounded, because every printed amount in the
 * app truncates: a cell rounded up would show 0.01 USDC worth $0.02.
 */
export const truncateToCents = (valueD18: bigint) => (valueD18 / CENT) * CENT;

/** Token amounts are normalised to 18 decimals so one coin can be summed across chains that scale it differently (USDC is 6 on Circle-native chains, 18 on BNB). */
export const toD18 = (amount: bigint, decimals: number) => (amount * D18) / 10n ** BigInt(decimals);

export type PortfolioToken = {
  chain: CentrifugeChain;
  chainId: number;
  address: Address;
  symbol: string;
  decimals: number;
  kind: 'share' | 'asset';
};

export const tokenKey = (token: { chain: CentrifugeChain; address: string }) =>
  `${token.chain}:${token.address.toLowerCase()}`;
export const vaultKey = (identity: TransactionIdentity) =>
  `${identity.centrifugeVault.chain}:${identity.centrifugeVault.address.toLowerCase()}`;

/** One identity per Centrifuge vault, in the given order. */
function uniqueIdentities(identities: ReadonlyArray<TransactionIdentity>): Array<TransactionIdentity> {
  return [...new Map(identities.map((identity) => [vaultKey(identity), identity])).values()];
}

/** Every token the wallet can hold against these vaults: the share token on each chain, then each chain's deposit assets. */
export function portfolioTokens(identities: ReadonlyArray<TransactionIdentity>): Array<PortfolioToken> {
  const tokens = new Map<string, PortfolioToken>();
  for (const { centrifugeVault: vault } of identities) {
    const share: PortfolioToken = {
      chain: vault.chain,
      chainId: vault.chainId,
      address: vault.shareClass.shareTokenAddress,
      symbol: vault.shareClass.symbol,
      decimals: vault.shareClass.decimals,
      kind: 'share'
    };
    const asset: PortfolioToken = {
      chain: vault.chain,
      chainId: vault.chainId,
      address: vault.asset.address,
      symbol: vault.asset.symbol,
      decimals: vault.asset.decimals,
      kind: 'asset'
    };
    for (const token of [share, asset]) if (!tokens.has(tokenKey(token))) tokens.set(tokenKey(token), token);
  }
  return [...tokens.values()];
}

/** The three places a coin can be, in 18-decimal token units. */
export type Amounts = {
  /** In the wallet: transferable, redeemable. */
  wallet: bigint;
  /** In redemption: shares in escrow waiting for approval or a cancellation, and settled stablecoins the chain's escrow cannot pay yet. */
  inRedemption: bigint;
  /** Ready to claim: settled proceeds and returned shares waiting for the wallet's claim. */
  readyToClaim: bigint;
};

export type NetworkHolding = Amounts & { chain: CentrifugeChain; valueD18: bigint | null };

export type TokenHolding = Amounts & {
  symbol: string;
  kind: 'share' | 'asset';
  /** USD, 18 decimals; null for the share token while its price is unknown. Deposit assets are always priced. */
  valueD18: bigint | null;
  /** Only the networks holding something, in deployment order. */
  networks: Array<NetworkHolding>;
};

export type RedemptionEntry = { identity: TransactionIdentity; state: RedemptionState };

export type Portfolio = {
  /** The chains these vaults span, in deployment order — the denominator for "every chain failed". */
  chains: Array<CentrifugeChain>;
  /** Only tokens the wallet holds or has in flight; the share token first. */
  tokens: Array<TokenHolding>;
  /** Every redemption state across every vault, in deployment order — the Pending tab's strips, as data. */
  redemptions: Array<RedemptionEntry>;
  /**
   * USD, 18 decimals; null until every read has answered or failed and the
   * share price is known. A failed chain's reads count as nothing (the hero
   * says so); only every chain failing withholds the figure.
   */
  totalD18: bigint | null;
  /** The total split by where the money is; null with the total. */
  buckets: { wallet: bigint; inRedemption: bigint; readyToClaim: bigint } | null;
  /** Chains with a balance or position read still on its first answer. */
  pendingChains: Array<CentrifugeChain>;
  /** Chains with a failed read and no earlier answer to fall back on. */
  failedChains: Array<CentrifugeChain>;
  /** The same, split by what failed, so a card blames the right read. */
  failedBalanceChains: Array<CentrifugeChain>;
  failedPositionChains: Array<CentrifugeChain>;
  /** The share price read failed with nothing cached: share figures cannot come. (Merely pending keeps pulsing.) */
  isPriceFailed: boolean;
};

const zero = (): Amounts => ({ wallet: 0n, inRedemption: 0n, readyToClaim: 0n });
const sum = (amounts: Amounts) => amounts.wallet + amounts.inRedemption + amounts.readyToClaim;

/**
 * The wallet's whole position across every chain, from the raw reads the
 * vault page already makes: ERC-20 balances per token and chain, the
 * Redemption Position per Centrifuge vault, and the hub share price.
 * Pure, so every bucket and total is a function of those inputs alone.
 */
export function buildPortfolio({
  identities: allIdentities,
  balances,
  positions,
  sharePrice,
  isPriceFailed = false
}: {
  identities: ReadonlyArray<TransactionIdentity>;
  /** By tokenKey. */
  balances: ReadonlyMap<string, ReadState<bigint>>;
  /** By vaultKey. */
  positions: ReadonlyMap<string, ReadState<RedemptionPosition>>;
  sharePrice: bigint | undefined;
  isPriceFailed?: boolean;
}): Portfolio {
  const identities = uniqueIdentities(allIdentities);
  const tokens = portfolioTokens(identities);
  const pendingChains = new Set<CentrifugeChain>();
  const failedBalanceChains = new Set<CentrifugeChain>();
  const failedPositionChains = new Set<CentrifugeChain>();
  const markRead = (chain: CentrifugeChain, read: ReadState<unknown> | undefined, failed: Set<CentrifugeChain>) => {
    if (read?.data !== undefined) return;
    if (read?.isError) failed.add(chain);
    else pendingChains.add(chain);
  };
  // Status lines name chains in deployment order, whatever order the reads land in.
  const chainOrder = identities.map((identity) => identity.centrifugeVault.chain);
  const ordered = (chains: Set<CentrifugeChain>) =>
    [...chains].sort((a, b) => chainOrder.indexOf(a) - chainOrder.indexOf(b));

  // symbol → chain → amounts, in first-seen order on both levels.
  const rows = new Map<string, { kind: 'share' | 'asset'; networks: Map<CentrifugeChain, Amounts> }>();
  const amountsOf = (symbol: string, kind: 'share' | 'asset', chain: CentrifugeChain): Amounts => {
    let row = rows.get(symbol);
    if (!row) {
      row = { kind, networks: new Map() };
      rows.set(symbol, row);
    }
    let amounts = row.networks.get(chain);
    if (!amounts) {
      amounts = zero();
      row.networks.set(chain, amounts);
    }
    return amounts;
  };

  for (const token of tokens) {
    const read = balances.get(tokenKey(token));
    markRead(token.chain, read, failedBalanceChains);
    amountsOf(token.symbol, token.kind, token.chain).wallet += toD18(read?.data ?? 0n, token.decimals);
  }

  const redemptions: Array<RedemptionEntry> = [];
  for (const identity of identities) {
    const { chain, asset, shareClass } = identity.centrifugeVault;
    const read = positions.get(vaultKey(identity));
    markRead(chain, read, failedPositionChains);
    for (const state of redemptionStates(read?.data)) {
      redemptions.push({ identity, state });
      const shares = amountsOf(shareClass.symbol, 'share', chain);
      const assets = amountsOf(asset.symbol, 'asset', chain);
      switch (state.kind) {
        case 'processing':
        case 'cancelling':
          shares.inRedemption += toD18(state.shares, shareClass.decimals);
          break;
        case 'returned':
          shares.readyToClaim += toD18(state.shares, shareClass.decimals);
          break;
        case 'unfunded':
          assets.inRedemption += toD18(state.assets, asset.decimals);
          break;
        case 'claimable':
          assets.readyToClaim += toD18(state.assets, asset.decimals);
          break;
      }
    }
  }

  // Every deposit asset is a dollar stablecoin by catalog policy, so each is
  // valued at face whatever its symbol — the testnet EURC included, the same
  // one-unit-one-dollar reading the deposit and redeem flows use.
  const priceOf = (kind: 'share' | 'asset') => (kind === 'share' ? sharePrice : D18);
  // Every USD figure on the page is a sum of these cells, each cut to the cent
  // first, so the buckets add up to the total and the token rows to the
  // families exactly as printed — never a cent apart. Truncated like the
  // amounts beside them, so a coin's dollar figure never reads above its amount.
  const cents = (amount: bigint, price: bigint) => truncateToCents((amount * price) / D18);

  const holdings: Array<TokenHolding> = [];
  const buckets = { wallet: 0n, inRedemption: 0n, readyToClaim: 0n };
  for (const [symbol, row] of rows) {
    const networks: Array<NetworkHolding> = [];
    const total = zero();
    const price = priceOf(row.kind);
    let valueD18: bigint | null = price === undefined ? null : 0n;
    for (const [chain, amounts] of row.networks) {
      if (sum(amounts) === 0n) continue;
      let networkValue: bigint | null = null;
      if (price !== undefined) {
        const cell = {
          wallet: cents(amounts.wallet, price),
          inRedemption: cents(amounts.inRedemption, price),
          readyToClaim: cents(amounts.readyToClaim, price)
        };
        buckets.wallet += cell.wallet;
        buckets.inRedemption += cell.inRedemption;
        buckets.readyToClaim += cell.readyToClaim;
        networkValue = sum(cell);
        valueD18! += networkValue;
      }
      networks.push({ chain, ...amounts, valueD18: networkValue });
      total.wallet += amounts.wallet;
      total.inRedemption += amounts.inRedemption;
      total.readyToClaim += amounts.readyToClaim;
    }
    if (networks.length === 0) continue;
    holdings.push({ symbol, kind: row.kind, ...total, valueD18, networks });
  }
  holdings.sort((a, b) => Number(b.kind === 'share') - Number(a.kind === 'share'));

  const chains = [...new Set(chainOrder)];
  const failedChains = new Set([...failedBalanceChains, ...failedPositionChains]);
  // One flaky RPC must not blank the page: a failed chain is left out of the
  // figures and named by the hero. Every chain failing is an outage, and
  // then there is nothing honest to print.
  const everyChainFailed = failedChains.size > 0 && failedChains.size === chains.length;
  const settled = pendingChains.size === 0 && sharePrice !== undefined && !everyChainFailed;

  return {
    chains,
    tokens: holdings,
    redemptions,
    totalD18: settled ? sum(buckets) : null,
    buckets: settled ? buckets : null,
    pendingChains: ordered(pendingChains),
    failedChains: ordered(failedChains),
    failedBalanceChains: ordered(failedBalanceChains),
    failedPositionChains: ordered(failedPositionChains),
    isPriceFailed: sharePrice === undefined && isPriceFailed
  };
}
