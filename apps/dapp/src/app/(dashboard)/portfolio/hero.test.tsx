// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PortfolioHero } from './hero';
import { portfolioOf } from './test-helpers';

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

const D18 = 10n ** 18n;
const ADDRESS = '0xb8DA328A4edB64af841C6bb72b55988e9abeB172';

afterEach(cleanup);

describe('PortfolioHero', () => {
  it('prints the total, the families and the buckets from the one model', () => {
    render(
      <PortfolioHero
        address={ADDRESS}
        isPreview={false}
        isHolding={false}
        shareSymbol="zSMB"
        portfolio={portfolioOf({
          tokens: [
            {
              symbol: 'zSMB',
              kind: 'share',
              wallet: 0n,
              inRedemption: 0n,
              readyToClaim: 0n,
              valueD18: 4n * D18,
              networks: []
            },
            {
              symbol: 'USDC',
              kind: 'asset',
              wallet: 0n,
              inRedemption: 0n,
              readyToClaim: 0n,
              valueD18: 53n * D18,
              networks: []
            }
          ],
          totalD18: 57n * D18,
          buckets: { wallet: 55n * D18, inRedemption: 2n * D18, readyToClaim: 0n }
        })}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('My Portfolio');
    expect(screen.getByText('0xb8DA...B172')).toBeTruthy();
    expect(screen.getByText('$57.00')).toBeTruthy();
    expect(screen.getByText('$4.00')).toBeTruthy();
    expect(screen.getByText('$53.00')).toBeTruthy();
    expect(screen.getByText('$55.00')).toBeTruthy();
    expect(screen.getByText('$2.00')).toBeTruthy();
    expect(screen.getByText('$0.00')).toBeTruthy();
    expect(screen.getByText('Ready to claim')).toBeTruthy();
  });

  it('pulses while chains are still answering, and names them only once the settle window has run out', () => {
    const pending = portfolioOf({ totalD18: null, buckets: null, pendingChains: ['base-sepolia'] });
    const { rerender } = render(
      <PortfolioHero
        address={ADDRESS}
        isPreview
        isHolding
        shareSymbol="zSMB"
        portfolio={pending}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );

    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Portfolio preview');
    expect(screen.queryByText(/Still checking/)).toBeNull();
    expect(screen.queryByText('—')).toBeNull();

    rerender(
      <PortfolioHero
        address={ADDRESS}
        isPreview
        isHolding={false}
        shareSymbol="zSMB"
        portfolio={pending}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );
    expect(screen.getByText('Still checking Base…')).toBeTruthy();
  });

  it('settles every figure on a dash when the share price is missing', () => {
    render(
      <PortfolioHero
        address={ADDRESS}
        isPreview={false}
        isHolding={false}
        shareSymbol="zSMB"
        portfolio={portfolioOf({ totalD18: null, buckets: null, isPriceFailed: true })}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );

    expect(screen.getAllByText('—')).toHaveLength(6); // total, two families, three buckets
    expect(screen.getByText(/Share price unavailable/)).toBeTruthy();
  });

  it('leaves a failed chain out of the figures, says so, and offers a retry', () => {
    const refetch = vi.fn();
    render(
      <PortfolioHero
        address={ADDRESS}
        isPreview={false}
        isHolding={false}
        shareSymbol="zSMB"
        portfolio={portfolioOf({
          chains: ['sepolia', 'base-sepolia'],
          totalD18: 57n * D18,
          buckets: { wallet: 55n * D18, inRedemption: 2n * D18, readyToClaim: 0n },
          failedChains: ['sepolia'],
          failedBalanceChains: ['sepolia']
        })}
        refetch={refetch}
        isRefetching={false}
      />
    );

    expect(screen.getByText('$57.00')).toBeTruthy();
    expect(screen.getByText('$55.00')).toBeTruthy();
    expect(screen.queryByText('—')).toBeNull();
    expect(screen.getByText(/Could not load Ethereum; these figures leave it out\./)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('collapses every chain failing into one sentence naming what could not be read', () => {
    const chains = ['sepolia', 'base-sepolia'] as const;
    const { rerender } = render(
      <PortfolioHero
        address={ADDRESS}
        isPreview={false}
        isHolding={false}
        shareSymbol="zSMB"
        portfolio={portfolioOf({
          chains: [...chains],
          totalD18: null,
          buckets: null,
          failedChains: [...chains],
          failedPositionChains: [...chains]
        })}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );
    expect(screen.getByText(/Could not load your positions\./)).toBeTruthy();
    expect(screen.queryByText(/Ethereum/)).toBeNull();
    expect(screen.getAllByText('—')).toHaveLength(6); // nothing honest to print: total, two families, three buckets

    rerender(
      <PortfolioHero
        address={ADDRESS}
        isPreview={false}
        isHolding={false}
        shareSymbol="zSMB"
        portfolio={portfolioOf({
          chains: [...chains],
          totalD18: null,
          buckets: null,
          failedChains: [...chains],
          failedBalanceChains: [...chains],
          failedPositionChains: [...chains]
        })}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );
    expect(screen.getByText(/Could not load your balances and positions\./)).toBeTruthy();
  });
});
