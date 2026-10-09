// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type ActivityEntry } from '@/portfolio';
import { ZSMB_ZIVOE_VAULT, resolveTransactionIdentity } from '@/zivoe-vaults';

import { Activity } from './activity';

const mocks = vi.hoisted(() => ({
  feed: {
    entries: [] as Array<ActivityEntry>,
    status: 'success',
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn()
  }
}));

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/core/link', () => ({
  NextLink: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>
}));
vi.mock('@/portfolio', () => ({ usePortfolioActivity: () => mocks.feed }));

/** The amount cell: a conversion spans two unbreakable spans, so match the cell's whole text. */
const amountCell = (text: string) =>
  screen.getByText((_, element) => element?.tagName === 'P' && element.textContent === text);

const SEPOLIA = resolveTransactionIdentity(ZSMB_ZIVOE_VAULT, 'sepolia');
const ADDRESS = '0xb8DA328A4edB64af841C6bb72b55988e9abeB172';
const T0 = Date.UTC(2026, 8, 16, 15, 37);

function entry(overrides: Partial<ActivityEntry> & { kind: ActivityEntry['kind'] }): ActivityEntry {
  return {
    id: `${overrides.kind}:${overrides.txHash ?? '0xtx'}`,
    chain: 'sepolia',
    txHash: '0xtx',
    timestampMs: T0,
    shares: 500_000_000_000_000_000n,
    assets: null,
    ...overrides
  };
}

afterEach(() => {
  cleanup();
  mocks.feed.entries = [];
  mocks.feed.status = 'success';
  mocks.feed.hasNextPage = false;
});

describe('Activity', () => {
  it('names each entry and reads its amounts in the direction the money moved', () => {
    mocks.feed.entries = [
      entry({ kind: 'deposit', txHash: '0xa', assets: { amount: 1_000_000n, symbol: 'USDC', decimals: 6 } }),
      entry({ kind: 'redemption-processed', txHash: '0xb', assets: { amount: 568_775n, symbol: 'USDC', decimals: 6 } }),
      entry({
        kind: 'proceeds-claimed',
        txHash: '0xc',
        shares: null,
        assets: { amount: 568_775n, symbol: 'USDC', decimals: 6 }
      }),
      entry({ kind: 'returned', txHash: '0xd' }),
      entry({ kind: 'issued', txHash: '0xe' })
    ];

    render(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);

    expect(amountCell('1.00 USDC → 0.50 zSMB')).toBeTruthy();
    expect(amountCell('0.50 zSMB → 0.56 USDC')).toBeTruthy();
    expect(amountCell('0.56 USDC')).toBeTruthy();
    expect(screen.getByText('Redemption Cancelled')).toBeTruthy();
    expect(screen.getByText('zVLT Migration')).toBeTruthy();
    expect(screen.getAllByText('16 Sep 2026')).toHaveLength(5);
    expect(screen.getByRole('link', { name: /Deposited/ }).getAttribute('href')).toContain('/tx/0xa');
    // Five entries and no further page: nothing to open.
    expect(screen.queryByRole('button', { name: 'View all' })).toBeNull();
  });

  it('keeps a received transfer unnamed until its receipt has answered', () => {
    mocks.feed.entries = [entry({ kind: 'received', unresolved: true })];

    render(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);

    expect(screen.queryByText('Received')).toBeNull();
    expect(amountCell('0.50 zSMB')).toBeTruthy();
  });

  it('has an empty, a loading and a failed state', () => {
    const { rerender } = render(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);
    expect(screen.getByText(/No activity yet/)).toBeTruthy();

    mocks.feed.status = 'pending';
    rerender(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);
    expect(screen.getByLabelText('Loading activity')).toBeTruthy();

    mocks.feed.status = 'error';
    rerender(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(mocks.feed.refetch).toHaveBeenCalledTimes(1);
  });

  it('offers the full history when there is more than the card shows', () => {
    mocks.feed.entries = [entry({ kind: 'sent' })];
    mocks.feed.hasNextPage = true;

    render(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);

    expect(screen.getByRole('button', { name: 'View all' })).toBeTruthy();
  });
});

describe('All activity dialog', () => {
  const observers: Array<{ callback: IntersectionObserverCallback; observed: Array<Element> }> = [];
  class FakeIntersectionObserver {
    observed: Array<Element> = [];
    constructor(public callback: IntersectionObserverCallback) {
      observers.push(this);
    }
    observe(element: Element) {
      this.observed.push(element);
    }
    disconnect() {
      // Nothing to release in a fake.
    }
  }

  it('asks for the next page when the sentinel scrolls into view, once per page', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver);
    mocks.feed.entries = Array.from({ length: 6 }, (_, index) => entry({ kind: 'sent', txHash: `0x${index}` }));
    mocks.feed.hasNextPage = true;

    const { rerender } = render(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);
    fireEvent.click(screen.getByRole('button', { name: 'View all' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();

    const observer = observers.at(-1)!;
    expect(observer.observed).toHaveLength(1);
    observer.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as never);
    expect(mocks.feed.fetchNextPage).toHaveBeenCalledTimes(1);

    // While the page is on its way the sentinel says so and does not ask again.
    mocks.feed.isFetchingNextPage = true;
    rerender(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);
    expect(screen.getByRole('status').textContent).toBe('Loading more…');
    observers.at(-1)!.callback([{ isIntersecting: true } as IntersectionObserverEntry], observer as never);
    expect(mocks.feed.fetchNextPage).toHaveBeenCalledTimes(1);

    // The last page removes the sentinel.
    mocks.feed.isFetchingNextPage = false;
    mocks.feed.hasNextPage = false;
    rerender(<Activity identities={[SEPOLIA]} accountAddress={ADDRESS} />);
    expect(screen.queryByRole('status')).toBeNull();
    vi.unstubAllGlobals();
  });
});
