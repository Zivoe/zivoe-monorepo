// @vitest-environment jsdom
import { type AnchorHTMLAttributes } from 'react';

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PerenaDemoCard } from './card';
import { PERENA_DEMO, PERENA_DEMO_PATH } from './config';
import { PerenaDemoPage } from './demo-page';
import { restoreDemoSession } from './state';

const mocks = vi.hoisted(() => ({ desktop: true, query: '' }));
vi.mock('react-responsive', () => ({
  useMediaQuery: ({ query }: { query: string }) => (query.includes('min-width') ? mocks.desktop : !mocks.desktop)
}));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(mocks.query) }));
vi.mock('@zivoe/ui/core/link', () => ({
  Link: ({ children, href }: AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href}>{children}</a>,
  NextLink: ({ children, href, 'aria-label': label }: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} aria-label={label}>
      {children}
    </a>
  )
}));

beforeEach(() => {
  mocks.desktop = true;
  mocks.query = '';
  sessionStorage.clear();
  vi.useFakeTimers();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    }
  );
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('Demo must not make network requests');
    })
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function connect() {
  fireEvent.click(screen.getByRole('button', { name: 'Use demo wallet' }));
}

function enter(value: string, redeem = false) {
  fireEvent.change(screen.getByRole('textbox', { name: redeem ? 'Shares to redeem' : 'USDC amount' }), {
    target: { value }
  });
}

function confirm() {
  fireEvent.click(screen.getByRole('button', { name: 'Simulate transaction' }));
  expect(screen.getByRole('heading', { name: 'Simulating transaction…' })).toBeTruthy();
  act(() => {
    vi.advanceTimersByTime(PERENA_DEMO.processingMs);
  });
}

function stored() {
  return restoreDemoSession(sessionStorage.getItem(PERENA_DEMO.storageKey));
}

describe('demo experience', () => {
  it('links the independent card to the static demo route', () => {
    render(<PerenaDemoCard />);
    expect(screen.getByRole('link', { name: 'Explore Zivoe Alternative Credit demo' }).getAttribute('href')).toBe(
      PERENA_DEMO_PATH
    );
  });

  it('shows amount and exact estimated receive before connecting and preserves the entered amount', () => {
    render(<PerenaDemoPage initialTab="deposit" />);
    enter('123.456789');
    const estimate = screen.getByRole<HTMLInputElement>('textbox', { name: 'Estimated receive' });
    expect(estimate.value).toBe('123.456789');
    expect(estimate.readOnly).toBe(true);
    expect(screen.queryByRole('button', { name: 'Review deposit' })).toBeNull();
    connect();
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'USDC amount' }).value).toBe('123.456789');
    expect(estimate.value).toBe('123.456789');
    enter('-1');
    expect(estimate.value).toBe('');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('expands the proposed strategy and links to Perena documents and the inquiry contact', () => {
    render(<PerenaDemoPage initialTab="deposit" />);
    fireEvent.click(screen.getByRole('button', { name: 'Show More' }));
    expect(screen.getByRole('button', { name: 'Show Less' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show Less' }));
    expect(screen.getByRole('link', { name: 'Perena V2 overview' }).getAttribute('href')).toBe(PERENA_DEMO.docsUrl);
    expect(screen.getByRole('link', { name: 'Perena V2 user documentation' }).getAttribute('href')).toBe(
      `${PERENA_DEMO.docsUrl}/for-users`
    );
    expect(screen.getByRole('link', { name: /inquire@/ }).getAttribute('href')).toMatch(/^mailto:/);
  });

  it('deposits, cancels, partially and fully redeems, restores and resets without network calls', () => {
    const page = render(<PerenaDemoPage initialTab="deposit" />);
    connect();
    enter('123.456789');
    fireEvent.click(screen.getByRole('button', { name: 'Review deposit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(stored().shares).toBe(0n);
    fireEvent.click(screen.getByRole('button', { name: 'Review deposit' }));
    confirm();
    expect(stored().shares).toBe(123_456_789n);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Redeem' }));
    enter('23.456789', true);
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Estimated receive' }).value).toBe('23.456789');
    fireEvent.click(screen.getByRole('button', { name: 'Review redemption' }));
    confirm();
    expect(stored().shares).toBe(100_000_000n);

    page.unmount();
    render(<PerenaDemoPage initialTab="redeem" />);
    expect(screen.queryByRole('button', { name: 'Use demo wallet' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Max' }));
    fireEvent.click(screen.getByRole('button', { name: 'Review redemption' }));
    confirm();
    expect(stored().shares).toBe(0n);
    expect(stored().usdc).toBe(PERENA_DEMO.initialUsdc);
    expect(stored().activity).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Reset demo' }));
    expect(stored().activity).toEqual([]);
    expect(screen.getByRole('button', { name: 'Use demo wallet' })).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(['', '-1', '0', '1001', '0.0000001'])('disables review for invalid input %j', (value) => {
    render(<PerenaDemoPage initialTab="deposit" />);
    connect();
    enter(value);
    expect(screen.getByRole('button', { name: 'Review deposit' }).hasAttribute('disabled')).toBe(true);
  });

  it('locks confirmation and tabs until processing completes', () => {
    render(<PerenaDemoPage initialTab="deposit" />);
    connect();
    enter('100');
    fireEvent.click(screen.getByRole('button', { name: 'Review deposit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simulate transaction' }));
    expect(screen.queryByRole('button', { name: 'Simulate transaction' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Redeem' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Reset demo' }).hasAttribute('disabled')).toBe(true);
    act(() => {
      vi.advanceTimersByTime(PERENA_DEMO.processingMs * 3);
    });
    expect(stored().activity).toHaveLength(1);
  });

  it.each(['deposit', 'redeem'] as const)('opens mobile %s deep links using the existing dialog', (tab) => {
    mocks.desktop = false;
    mocks.query = `view=${tab}`;
    render(<PerenaDemoPage initialTab={tab} />);
    const dialog = screen.getByRole('dialog', { name: 'Earn' });
    expect(within(dialog).getAllByRole('heading')).toHaveLength(1);
    expect(within(dialog).getByRole('textbox', { name: 'Estimated receive' })).toBeTruthy();
    expect(
      within(dialog)
        .getByRole('tab', { name: tab === 'deposit' ? 'Deposit' : 'Redeem' })
        .getAttribute('aria-selected')
    ).toBe('true');
    expect(within(dialog).getByText('Interactive demo. Balances and transactions are simulated.')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close dialog' }));
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('continues locally when session storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Storage blocked');
    });
    render(<PerenaDemoPage initialTab="deposit" />);
    expect(screen.getByText(/Session storage is unavailable/)).toBeTruthy();
    connect();
    enter('1');
    fireEvent.click(screen.getByRole('button', { name: 'Review deposit' }));
    confirm();
    expect(screen.getByRole('heading', { name: 'Deposit simulated' })).toBeTruthy();
  });
});
