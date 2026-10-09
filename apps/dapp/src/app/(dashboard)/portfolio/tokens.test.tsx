// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { portfolioOf } from './test-helpers';
import { Tokens } from './tokens';

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);

const D18 = 10n ** 18n;

afterEach(cleanup);

describe('Tokens', () => {
  it('lists what the wallet holds with what of it is in flight, and the networks it sits on', () => {
    render(
      <Tokens
        portfolio={portfolioOf({
          tokens: [
            {
              symbol: 'zSMB',
              kind: 'share',
              wallet: 2n * D18,
              inRedemption: D18 / 2n,
              readyToClaim: 0n,
              valueD18: 285n * 10n ** 16n,
              networks: [
                { chain: 'sepolia', wallet: 2n * D18, inRedemption: 0n, readyToClaim: 0n, valueD18: 228n * 10n ** 16n },
                {
                  chain: 'base-sepolia',
                  wallet: 0n,
                  inRedemption: D18 / 2n,
                  readyToClaim: 0n,
                  valueD18: 57n * 10n ** 16n
                }
              ]
            },
            {
              symbol: 'USDC',
              kind: 'asset',
              wallet: 5n * D18,
              inRedemption: 0n,
              readyToClaim: 4n * D18,
              valueD18: 9n * D18,
              networks: [
                { chain: 'sepolia', wallet: 5n * D18, inRedemption: 0n, readyToClaim: 4n * D18, valueD18: 9n * D18 }
              ]
            }
          ]
        })}
        isHolding={false}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );

    expect(screen.getByText('2.00 zSMB')).toBeTruthy();
    expect(screen.getByText('0.50 zSMB in redemption')).toBeTruthy();
    expect(screen.getByText('$2.85 in total')).toBeTruthy();
    expect(screen.getByRole('button', { name: '2 networks: Ethereum, Base' })).toBeTruthy();
    expect(screen.getByText('5.00 USDC')).toBeTruthy();
    expect(screen.getByText('4.00 USDC ready to claim')).toBeTruthy();
    expect(screen.getByRole('button', { name: '1 network: Ethereum' })).toBeTruthy();
  });

  it('shows skeleton rows inside the settle window, then names the chains still being read', () => {
    const pending = portfolioOf({ pendingChains: ['sepolia'] });
    const { rerender } = render(<Tokens portfolio={pending} isHolding refetch={vi.fn()} isRefetching={false} />);
    expect(screen.getByLabelText('Loading tokens')).toBeTruthy();
    expect(screen.queryByText(/Still checking/)).toBeNull();
    expect(screen.queryByText(/No holdings yet/)).toBeNull();

    rerender(<Tokens portfolio={pending} isHolding={false} refetch={vi.fn()} isRefetching={false} />);
    expect(screen.queryByLabelText('Loading tokens')).toBeNull();
    expect(screen.getByText('Still checking Ethereum…')).toBeTruthy();

    // Past two chains the line counts the rest, so it stays one line on a phone.
    rerender(
      <Tokens
        portfolio={portfolioOf({ pendingChains: ['sepolia', 'base-sepolia', 'arbitrum', 'avalanche'] })}
        isHolding={false}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );
    expect(screen.getByText('Still checking Ethereum, Base and 2 more…')).toBeTruthy();
  });

  it('names a failed position read too, since the in-flight lines come from it', () => {
    const chains = ['sepolia', 'base-sepolia'] as const;
    const { rerender } = render(
      <Tokens
        portfolio={portfolioOf({
          chains: [...chains],
          failedChains: ['base-sepolia'],
          failedPositionChains: ['base-sepolia']
        })}
        isHolding={false}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );
    expect(screen.getByText(/Could not load positions on Base; the figures there may be incomplete\./)).toBeTruthy();
    expect(screen.queryByText(/No holdings yet/)).toBeNull();

    rerender(
      <Tokens
        portfolio={portfolioOf({
          chains: [...chains],
          failedChains: [...chains],
          failedBalanceChains: [...chains],
          failedPositionChains: ['sepolia']
        })}
        isHolding={false}
        refetch={vi.fn()}
        isRefetching={false}
      />
    );
    expect(screen.getByText(/Could not load your balances and positions\./)).toBeTruthy();
  });

  it('says so when the wallet holds nothing', () => {
    render(<Tokens portfolio={portfolioOf()} isHolding={false} refetch={vi.fn()} isRefetching={false} />);
    expect(screen.getByText(/No holdings yet/)).toBeTruthy();
  });
});
