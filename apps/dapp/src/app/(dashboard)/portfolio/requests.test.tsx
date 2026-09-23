// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type RedemptionPosition } from '@/centrifuge/types';
import { buildPortfolio, portfolioTokens, positionKey, tokenKey } from '@/portfolio/model';
import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { Requests } from './requests';

vi.mock('@zivoe/ui/core/link', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>
}));
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({ children, onPress }: { children: ReactNode; onPress: () => void }) => (
    <button onClick={onPress}>{children}</button>
  )
}));
afterEach(cleanup);
const empty: RedemptionPosition = {
  pendingRedeemShares: 0n,
  claimableRedeemAssets: 0n,
  claimableRedeemSharesEquivalent: 0n,
  unfundedClaimableAssets: 0n,
  claimableCancelRedeemShares: 0n,
  hasPendingCancelRedeemRequest: false
};
const identities = [
  FIXTURE_IDENTITY,
  identityOnChain(FIXTURE_IDENTITY, 'base-sepolia'),
  identityOnChain(FIXTURE_IDENTITY, 'sepolia', {
    address: '0x1111111111111111111111111111111111111111',
    asset: { ...FIXTURE_IDENTITY.centrifugeVault.asset, symbol: 'USDT' }
  })
];
function model(position = empty) {
  return buildPortfolio({
    identities,
    balances: new Map(
      portfolioTokens(identities).map((token) => [tokenKey(token), { data: 0n, isError: false, isPending: false }])
    ),
    positions: new Map(
      identities.map((identity) => [positionKey(identity), { data: position, isError: false, isPending: false }])
    ),
    sharePrice: { data: 10n ** 18n, isError: false, isPending: false }
  });
}
describe('read-only requests panel', () => {
  it('renders every state without truncation, counts states and links each to Pending', () => {
    const data = model({
      ...empty,
      pendingRedeemShares: 100n,
      claimableCancelRedeemShares: 50n,
      claimableRedeemAssets: 10n
    });
    render(<Requests model={data} refresh={vi.fn()} />);
    expect(screen.getByText('9 active')).toBeTruthy();
    const links = screen.getAllByRole('link', { name: 'Manage in vault' });
    expect(links).toHaveLength(9);
    expect(links.every((link) => link.getAttribute('href') === '/vaults/zivoe-smb-credit?view=pending')).toBe(true);
    expect(document.querySelectorAll('details[open]')).toHaveLength(2);
    expect(screen.getAllByText('Payout asset · USDT')).toHaveLength(3);
    expect(screen.queryByText('View all')).toBeNull();
    expect(screen.queryByRole('button', { name: /Claim|Cancel|Switch/ })).toBeNull();
  });
  it('only renders confirmed empty after all positions succeed, and offers retry alongside known states', () => {
    const refresh = vi.fn();
    const initial = model();
    const { rerender } = render(
      <Requests
        model={{ ...initial, requestsComplete: false, requestPendingChains: ['base-sepolia'] }}
        refresh={refresh}
      />
    );
    expect(screen.queryByText('No pending requests')).toBeNull();
    expect(screen.getByText(/Still checking/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(refresh).toHaveBeenCalledOnce();
    const active = model({ ...empty, hasPendingCancelRedeemRequest: true, unfundedClaimableAssets: 1n });
    rerender(
      <Requests
        model={{ ...active, requestsComplete: false, requestFailedChains: ['base-sepolia'] }}
        refresh={refresh}
      />
    );
    expect(screen.getAllByRole('link', { name: 'Manage in vault' })).toHaveLength(6);
    expect(screen.getByText(/Requests could not be checked on Base/)).toBeTruthy();
    rerender(<Requests model={initial} refresh={refresh} />);
    expect(screen.getByText('No pending requests')).toBeTruthy();
    expect(
      screen.getByText('Your redemption requests, cancellations, and funds ready to claim will appear here.')
    ).toBeTruthy();
  });
});
