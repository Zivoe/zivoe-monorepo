// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { identityOnChain } from '@/test/fixtures';
import { ZSMB_ZIVOE_VAULT, resolveTransactionIdentity } from '@/zivoe-vaults';

import { Redemptions } from './redemptions';
import { portfolioOf } from './test-helpers';

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/core/link', () => ({
  NextLink: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>
}));

const SEPOLIA_USDC = resolveTransactionIdentity(ZSMB_ZIVOE_VAULT, 'sepolia');
const SEPOLIA_USDT = identityOnChain(SEPOLIA_USDC, 'sepolia', {
  address: '0xc3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3',
  asset: { address: '0xf0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0', symbol: 'USDT', decimals: 6 }
});
const BASE_USDC = identityOnChain(SEPOLIA_USDC, 'base-sepolia', {
  address: '0xb3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3b3'
});
const VAULT = { name: 'Zivoe SMB Credit', path: '/vaults/zivoe-smb-credit' };
// Ethereum has two catalogued vaults here, Base one: captions follow the catalog, like the Pending tab.
const IDENTITIES = [SEPOLIA_USDC, SEPOLIA_USDT, BASE_USDC];

afterEach(cleanup);

describe('Redemptions', () => {
  it('prints every state as a ledger row, grouped by network, with one link to the tab', () => {
    render(
      <Redemptions
        identities={IDENTITIES}
        portfolio={portfolioOf({
          redemptions: [
            { identity: SEPOLIA_USDC, state: { kind: 'unfunded', assets: 568_775n } },
            { identity: SEPOLIA_USDT, state: { kind: 'processing', shares: 500_000_000_000_000_000n } },
            { identity: BASE_USDC, state: { kind: 'returned', shares: 1_000_000_000_000_000_000n } }
          ]
        })}
        isHolding={false}
        sharePrice={1_140_000_000_000_000_000n}
        zivoeVault={VAULT}
        refetch={vi.fn()}
      />
    );

    expect(screen.getByText('3 open')).toBeTruthy();
    // Each row: the amount, its status pill, and the one line that says what happens next.
    expect(screen.getByText('0.56 USDC')).toBeTruthy();
    expect(screen.getByText('Awaiting liquidity')).toBeTruthy();
    expect(screen.getByText('0.50 zSMB')).toBeTruthy();
    expect(screen.getByText('Processing')).toBeTruthy();
    expect(screen.getByText('1.00 zSMB')).toBeTruthy();
    expect(screen.getByText('Returned')).toBeTruthy();
    // Two catalogued vaults on Ethereum: each item's detail line opens with its coin, like the Pending tab; Base's single vault does not.
    expect(screen.getByText('USDC redemption · Approved, not yet funded on this network')).toBeTruthy();
    expect(screen.getByText('USDT redemption · ≈ 0.57 USDT on approval')).toBeTruthy();
    expect(screen.getAllByText(/^(USDC|USDT) redemption/)).toHaveLength(2);
    expect(screen.getByText('From a cancelled request')).toBeTruthy();
    // Group headers name the chain and how many items sit under it, like the Pending tab.
    expect(screen.getByRole('button', { name: /^Ethereum\s*2$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Base\s*1$/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Manage in Zivoe SMB Credit/ }).getAttribute('href')).toBe(
      '/vaults/zivoe-smb-credit?view=pending'
    );
  });

  it('says so when there is nothing in flight, and names chains still being read once the window has run out', () => {
    const { rerender } = render(
      <Redemptions
        identities={IDENTITIES}
        portfolio={portfolioOf()}
        isHolding={false}
        sharePrice={undefined}
        zivoeVault={VAULT}
        refetch={vi.fn()}
      />
    );
    expect(screen.getByText(/No redemption requests/)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Manage in Zivoe SMB Credit/ })).toBeTruthy();

    rerender(
      <Redemptions
        identities={IDENTITIES}
        portfolio={portfolioOf({ pendingChains: ['base-sepolia'] })}
        isHolding={false}
        sharePrice={undefined}
        zivoeVault={VAULT}
        refetch={vi.fn()}
      />
    );
    // Past the window with one chain still reading: the empty copy, with that chain named under it.
    expect(screen.getByText(/No redemption requests/)).toBeTruthy();
    expect(screen.getByText('Still checking Base…')).toBeTruthy();
  });

  it('shows the skeleton strip inside the settle window, whatever has already landed', () => {
    render(
      <Redemptions
        identities={IDENTITIES}
        portfolio={portfolioOf({
          pendingChains: ['base-sepolia'],
          redemptions: [{ identity: SEPOLIA_USDC, state: { kind: 'unfunded', assets: 568_775n } }]
        })}
        isHolding
        sharePrice={undefined}
        zivoeVault={VAULT}
        refetch={vi.fn()}
      />
    );
    expect(screen.getByLabelText('Loading redemption requests')).toBeTruthy();
    expect(screen.queryByText(/Awaiting liquidity/)).toBeNull();
    expect(screen.queryByText(/open$/)).toBeNull();
    expect(screen.queryByText(/Still checking/)).toBeNull();
  });

  it('keeps a chain listed, with a notice, when its position reads fail', () => {
    render(
      <Redemptions
        identities={IDENTITIES}
        portfolio={portfolioOf({ failedChains: ['sepolia'], failedPositionChains: ['sepolia'] })}
        isHolding={false}
        sharePrice={undefined}
        zivoeVault={VAULT}
        refetch={vi.fn()}
      />
    );

    // The Pending tab's own reading: the chain stays listed, the notice sits inside its group, and the
    // error backoff re-reads it — no Retry of its own.
    expect(screen.getByRole('button', { name: /^Ethereum\s*0$/ })).toBeTruthy();
    expect(screen.getByText(/Could not load every position on Ethereum/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.queryByText(/No redemption requests/)).toBeNull();
  });

  // Every vault resolves through the indexer, so an outage there fails all of
  // them at once: one notice, in the Pending tab's words, not a list of chains.
  it('collapses every chain failing into the Pending tab sentence, whose Retry re-reads everything', () => {
    const chains = ['sepolia', 'base-sepolia'] as const;
    const refetch = vi.fn();
    render(
      <Redemptions
        identities={IDENTITIES}
        portfolio={portfolioOf({ chains: [...chains], failedChains: [...chains], failedPositionChains: [...chains] })}
        isHolding={false}
        sharePrice={undefined}
        zivoeVault={VAULT}
        refetch={refetch}
      />
    );
    expect(screen.getByText(/Could not load your redemption requests\./)).toBeTruthy();
    expect(screen.queryByText(/every position/)).toBeNull();
    expect(screen.queryByText(/No redemption requests/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});
