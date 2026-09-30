// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type WalletActivity } from '@zivoe/centrifuge-indexer';

import { FIXTURE_IDENTITY, identityOnChain } from '@/test/fixtures';

import { Activity } from './activity';

const mocks = vi.hoisted(() => ({ next: vi.fn(), retry: vi.fn(), useActivity: vi.fn() }));
vi.mock('@/portfolio/use-portfolio', () => ({
  usePortfolioActivity: (transfers: boolean) => mocks.useActivity(transfers)
}));
vi.mock('@zivoe/ui/core/link', () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>
}));
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const entries: Array<WalletActivity> = Array.from({ length: 20 }, (_, index) => ({
  type: 'SYNC_DEPOSIT',
  chainId: 11155111,
  centrifugeId: '1',
  tokenAmount: BigInt(index + 1) * 10n ** 8n,
  currencyAmount: null,
  assetAddress: null,
  timestampMs: Date.parse('2026-09-23'),
  block: index,
  txHash: `0x${index}`,
  fromAccount: null,
  toAccount: null
}));

describe('portfolio activity', () => {
  it('shows five numbered recent rows, opens paginated activity, and closes the dialog with Escape', async () => {
    mocks.useActivity.mockReturnValue({
      data: { pages: [{ entries, nextCursor: 'next' }] },
      hasNextPage: true,
      isSuccess: true,
      fetchNextPage: mocks.next,
      refetch: mocks.retry
    });
    render(<Activity identities={[FIXTURE_IDENTITY]} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(5);
    rows.forEach((row, index) => expect(within(row).getByText(`${index + 1}.`)).toBeTruthy());
    expect(screen.queryByRole('tab', { name: 'Pending' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'View all activity' }));
    const dialog = await screen.findByRole('dialog', { name: 'All zSMB activity' });
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(20);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Load more activity' }));
    expect(mocks.next).toHaveBeenCalledOnce();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document.activeElement!, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('selects a dedicated transfer query and associates the tab with its panel', () => {
    mocks.useActivity.mockImplementation((transfers: boolean) => ({
      data: { pages: [{ entries: transfers ? [] : entries }] },
      isSuccess: true,
      fetchNextPage: mocks.next,
      refetch: mocks.retry
    }));
    render(<Activity identities={[FIXTURE_IDENTITY]} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Transfers' }));
    expect(mocks.useActivity).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('tabpanel', { name: 'Transfers' })).toBeTruthy();
    expect(screen.getByText('No indexed transfers yet.')).toBeTruthy();
  });

  it.each([
    { symbol: 'USDC', decimals: 6 },
    { symbol: 'USDT', decimals: 18 },
    { symbol: 'USD1', decimals: 6 }
  ] as const)('shows the recorded $symbol deposit amount using its own decimals and icon', ({ symbol, decimals }) => {
    const identity = identityOnChain(FIXTURE_IDENTITY, 'sepolia', {
      asset: { ...FIXTURE_IDENTITY.centrifugeVault.asset, symbol, decimals }
    });
    mocks.useActivity.mockReturnValue({
      data: {
        pages: [
          {
            entries: [
              {
                ...entries[0]!,
                tokenAmount: 8807n * 10n ** 4n,
                currencyAmount: 125n * 10n ** BigInt(decimals - 1),
                assetAddress: identity.centrifugeVault.asset.address.toUpperCase()
              }
            ]
          }
        ]
      },
      isSuccess: true
    });
    render(<Activity identities={[identity]} />);
    const row = within(screen.getByRole('listitem'));
    expect(row.getByText('12.5')).toBeTruthy();
    expect(row.getByRole('img', { name: symbol })).toBeTruthy();
    expect(row.getByText('0.8807')).toBeTruthy();
    expect(row.getAllByRole('img').map((icon) => icon.getAttribute('aria-label'))).toEqual([symbol, 'zSMB']);
    expect(row.getByText('→')).toBeTruthy();
  });

  it('does not substitute shares when the deposit currency cannot be identified', () => {
    mocks.useActivity.mockReturnValue({ data: { pages: [{ entries: [entries[0]] }] }, isSuccess: true });
    render(<Activity identities={[FIXTURE_IDENTITY]} />);
    const row = within(screen.getByRole('listitem'));
    expect(row.getByTitle('Amount unavailable')).toBeTruthy();
    expect(row.queryByRole('img', { name: 'zSMB' })).toBeNull();
  });

  it('keeps transfers denominated in zSMB', () => {
    mocks.useActivity.mockReturnValue({
      data: { pages: [{ entries: [{ ...entries[0]!, type: 'TRANSFER_OUT' }] }] },
      isSuccess: true
    });
    render(<Activity identities={[FIXTURE_IDENTITY]} />);
    const row = within(screen.getByRole('listitem'));
    expect(row.getByText('1')).toBeTruthy();
    expect(row.getByRole('img', { name: 'zSMB' })).toBeTruthy();
    expect(row.getByRole('link', { name: 'Sent' })).toBeTruthy();
  });

  it('combines a deposit and its received shares across pages, including in the Transfers tab', () => {
    const deposit = {
      ...entries[0]!,
      currencyAmount: 1_000_000n,
      assetAddress: FIXTURE_IDENTITY.centrifugeVault.asset.address
    };
    const received = { ...entries[0]!, type: 'TRANSFER_IN' };
    const standalone = { ...received, txHash: '0xseparate', block: 2 };
    mocks.useActivity.mockReturnValue({
      data: { pages: [{ entries: [received] }, { entries: [deposit, standalone, received] }] },
      isSuccess: true
    });
    render(<Activity identities={[FIXTURE_IDENTITY]} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Received' })).toHaveLength(1);
    const depositRow = screen.getByRole('link', { name: 'Deposit' }).closest('li')!;
    expect(
      within(depositRow)
        .getAllByRole('img')
        .map((icon) => icon.getAttribute('aria-label'))
    ).toEqual(['USDC', 'zSMB']);
    fireEvent.click(screen.getByRole('tab', { name: 'Transfers' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Received' })).toBeTruthy();
  });

  it('shows a completed redemption from shares into the recorded stablecoin', () => {
    mocks.useActivity.mockReturnValue({
      data: {
        pages: [
          {
            entries: [
              {
                ...entries[0]!,
                type: 'REDEEM_CLAIMED',
                tokenAmount: 350_000_000n,
                currencyAmount: 3_972_400n,
                assetAddress: FIXTURE_IDENTITY.centrifugeVault.asset.address
              }
            ]
          }
        ]
      },
      isSuccess: true
    });
    render(<Activity identities={[FIXTURE_IDENTITY]} />);
    const row = within(screen.getByRole('listitem'));
    expect(row.getByText('3.5')).toBeTruthy();
    expect(row.getByText('3.9724')).toBeTruthy();
    expect(row.getAllByRole('img').map((icon) => icon.getAttribute('aria-label'))).toEqual(['zSMB', 'USDC']);
  });
});
