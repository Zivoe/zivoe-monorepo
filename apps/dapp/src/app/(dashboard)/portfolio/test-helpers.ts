import { type Portfolio } from '@/portfolio';

/** A complete, empty portfolio to build test states from. */
export function portfolioOf(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    chains: [],
    tokens: [],
    redemptions: [],
    totalD18: 0n,
    buckets: { wallet: 0n, inRedemption: 0n, readyToClaim: 0n },
    pendingChains: [],
    failedChains: [],
    failedBalanceChains: [],
    failedPositionChains: [],
    isPriceFailed: false,
    ...overrides
  };
}
