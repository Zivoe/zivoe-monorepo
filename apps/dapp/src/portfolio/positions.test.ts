import { describe, expect, it } from 'vitest';

import { type RedemptionPosition } from '@/centrifuge';
import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { type ReadState, buildPortfolio, portfolioTokens, tokenKey, vaultKey } from './positions';

const D18 = 10n ** 18n;
const PRICE = 1_100_000_000_000_000_000n; // 1.10

// zFIX has 8 decimals, USDC 6 on sepolia; the Base vault takes an 18-decimal USDC.
const SEPOLIA = FIXTURE_IDENTITY;
const BASE = identityOnChain(SEPOLIA, 'base-sepolia', {
  address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3',
  asset: { address: '0xa1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1', symbol: 'USDC', decimals: 18 }
});
const EMPTY: RedemptionPosition = {
  pendingRedeemShares: 0n,
  claimableRedeemAssets: 0n,
  claimableRedeemSharesEquivalent: 0n,
  unfundedClaimableAssets: 0n,
  claimableCancelRedeemShares: 0n,
  hasPendingCancelRedeemRequest: false
};
const ok = <T>(data: T): ReadState<T> => ({ data, isError: false });
const pending: ReadState<never> = { data: undefined, isError: false };
const failed: ReadState<never> = { data: undefined, isError: true };

const [sepoliaShare, sepoliaUsdc, baseShare, baseUsdc] = portfolioTokens([SEPOLIA, BASE]);

function balancesOf(
  reads: Partial<Record<'sepoliaShare' | 'sepoliaUsdc' | 'baseShare' | 'baseUsdc', ReadState<bigint>>>
) {
  return new Map([
    [tokenKey(sepoliaShare!), reads.sepoliaShare ?? ok(0n)],
    [tokenKey(sepoliaUsdc!), reads.sepoliaUsdc ?? ok(0n)],
    [tokenKey(baseShare!), reads.baseShare ?? ok(0n)],
    [tokenKey(baseUsdc!), reads.baseUsdc ?? ok(0n)]
  ]);
}

function positionsOf(reads: { sepolia?: ReadState<RedemptionPosition>; base?: ReadState<RedemptionPosition> }) {
  return new Map([
    [vaultKey(SEPOLIA), reads.sepolia ?? ok(EMPTY)],
    [vaultKey(BASE), reads.base ?? ok(EMPTY)]
  ]);
}

describe('buildPortfolio', () => {
  it('splits wallet, in-redemption and ready-to-claim amounts and prices them once', () => {
    const portfolio = buildPortfolio({
      identities: [SEPOLIA, BASE],
      balances: balancesOf({
        sepoliaShare: ok(200_000_000n), // 2 zFIX
        sepoliaUsdc: ok(5_000_000n), // 5 USDC (6 dec)
        baseUsdc: ok(3n * D18) // 3 USDC (18 dec)
      }),
      positions: positionsOf({
        // 1 zFIX in escrow, 0.5 USDC approved but unfunded.
        sepolia: ok({ ...EMPTY, pendingRedeemShares: 100_000_000n, unfundedClaimableAssets: 500_000n }),
        // 4 USDC ready to claim and 0.25 zFIX returned from a cancellation on Base.
        base: ok({ ...EMPTY, claimableRedeemAssets: 4n * D18, claimableCancelRedeemShares: 25_000_000n })
      }),
      sharePrice: PRICE
    });

    expect(portfolio.chains).toEqual(['sepolia', 'base-sepolia']);
    expect(portfolio.pendingChains).toEqual([]);
    expect(portfolio.failedChains).toEqual([]);
    expect(portfolio.tokens.map((token) => token.symbol)).toEqual(['zFIX', 'USDC']);

    const [share, usdc] = portfolio.tokens;
    expect(share).toMatchObject({ wallet: 2n * D18, inRedemption: 1n * D18, readyToClaim: (D18 * 25n) / 100n });
    // 2.20 + 1.10 + 0.275: each cell cut to the cent before summing, so the 0.275 counts as 0.27.
    expect(share?.valueD18).toBe((357n * D18) / 100n);
    expect(share?.networks.map((network) => network.chain)).toEqual(['sepolia', 'base-sepolia']);
    expect(usdc).toMatchObject({ wallet: 8n * D18, inRedemption: D18 / 2n, readyToClaim: 4n * D18 });
    expect(usdc?.valueD18).toBe((125n * D18) / 10n); // 12.5 USDC at face

    // The token rows' values, which are the per-network cells summed, add up to the total exactly.
    expect(portfolio.totalD18).toBe(share!.valueD18! + usdc!.valueD18!);
    expect(portfolio.totalD18).toBe((1607n * D18) / 100n); // 3.57 + 12.50
    expect(portfolio.redemptions.map((entry) => [entry.identity.centrifugeVault.chain, entry.state.kind])).toEqual([
      ['sepolia', 'unfunded'],
      ['sepolia', 'processing'],
      ['base-sepolia', 'returned'],
      ['base-sepolia', 'claimable']
    ]);
  });

  it('hides tokens and networks holding nothing', () => {
    const portfolio = buildPortfolio({
      identities: [SEPOLIA, BASE],
      balances: balancesOf({ baseShare: ok(1n) }),
      positions: positionsOf({}),
      sharePrice: PRICE
    });

    expect(portfolio.tokens).toHaveLength(1);
    expect(portfolio.tokens[0]?.networks.map((network) => network.chain)).toEqual(['base-sepolia']);
    expect(portfolio.totalD18).toBe(0n); // 1e-8 zFIX is worth less than a cent
  });

  it('withholds the total while a read is pending, leaves a failed chain out of it, and withholds it when every chain failed', () => {
    const pendingRead = buildPortfolio({
      identities: [SEPOLIA, BASE],
      balances: balancesOf({ baseUsdc: pending }),
      positions: positionsOf({}),
      sharePrice: PRICE
    });
    expect(pendingRead.totalD18).toBeNull();
    expect(pendingRead.pendingChains).toEqual(['base-sepolia']);

    const failedRead = buildPortfolio({
      identities: [SEPOLIA, BASE],
      balances: balancesOf({ baseUsdc: ok(3n * D18) }),
      positions: positionsOf({ sepolia: failed }),
      sharePrice: PRICE
    });
    expect(failedRead.totalD18).toBe(3n * D18); // Base's 3 USDC; Ethereum's failed read counts as nothing
    expect(failedRead.failedChains).toEqual(['sepolia']);
    // Split by read, so a card can say which kind failed: this one is a position read.
    expect(failedRead.failedBalanceChains).toEqual([]);
    expect(failedRead.failedPositionChains).toEqual(['sepolia']);

    const everyChainFailed = buildPortfolio({
      identities: [SEPOLIA, BASE],
      balances: balancesOf({ baseUsdc: ok(3n * D18) }),
      positions: positionsOf({ sepolia: failed, base: failed }),
      sharePrice: PRICE
    });
    expect(everyChainFailed.totalD18).toBeNull();
    expect(everyChainFailed.failedChains).toEqual(['sepolia', 'base-sepolia']);
  });

  it('withholds the total without a share price but still lists the tokens', () => {
    const portfolio = buildPortfolio({
      identities: [SEPOLIA],
      balances: balancesOf({ sepoliaShare: ok(100_000_000n) }),
      positions: positionsOf({}),
      sharePrice: undefined
    });

    expect(portfolio.isPriceFailed).toBe(false); // pending, not failed: the figures keep pulsing
    expect(portfolio.totalD18).toBeNull();
    expect(portfolio.tokens[0]).toMatchObject({ symbol: 'zFIX', wallet: D18, valueD18: null });
  });

  it('values every deposit asset at face, whatever its symbol, and never prices a coin above its printed amount', () => {
    const eurc = identityOnChain(SEPOLIA, 'sepolia', {
      address: '0xe1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1e1',
      asset: { address: '0xe2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2e2', symbol: 'EURC', decimals: 6 }
    });
    const [, , eurcToken] = portfolioTokens([SEPOLIA, eurc]);

    const portfolio = buildPortfolio({
      identities: [SEPOLIA, eurc],
      balances: new Map([
        [tokenKey(sepoliaShare!), ok(0n)],
        // 2.489085 USDC prints as 2.48 and is worth $2.48 — never $2.49.
        [tokenKey(sepoliaUsdc!), ok(2_489_085n)],
        [tokenKey(eurcToken!), ok(2_000_000n)]
      ]),
      positions: new Map([
        [vaultKey(SEPOLIA), ok(EMPTY)],
        [vaultKey(eurc), ok(EMPTY)]
      ]),
      sharePrice: PRICE
    });

    expect(portfolio.tokens.find((token) => token.symbol === 'USDC')?.valueD18).toBe((248n * D18) / 100n);
    expect(portfolio.tokens.find((token) => token.symbol === 'EURC')).toMatchObject({
      wallet: 2n * D18,
      valueD18: 2n * D18
    });
    expect(portfolio.totalD18).toBe((448n * D18) / 100n);
  });
});
