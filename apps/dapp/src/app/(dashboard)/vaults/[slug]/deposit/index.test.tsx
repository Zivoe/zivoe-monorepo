// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { type Address } from 'viem';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Deposit from './index';

const mocks = vi.hoisted(() => ({ isMobile: true, requestCount: 0, address: undefined as Address | undefined }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('view=redeem'),
  usePathname: () => '/vaults/zivoe-smb-credit',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

vi.mock('react-responsive', () => ({ useMediaQuery: () => mocks.isMobile }));

// Raw UI TSX does not transform here; the Dialog mock keeps the one behavior
// under test — children render only while isOpen.
vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/lib/tw-utils', () => ({ cn: (...classes: Array<unknown>) => classes.join(' ') }));
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  )
}));
vi.mock('@zivoe/ui/core/tabs', () => ({
  Tabs: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Tab: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabPanel: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));
vi.mock('@zivoe/ui/core/dialog', () => ({
  DialogContent: ({ isOpen, children }: { isOpen?: boolean; children: ReactNode }) =>
    isOpen === false ? null : <div role="dialog">{children}</div>,
  DialogContentBox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('./deposit-flow', () => ({ DepositFlow: () => null }));
vi.mock('./redeem-flow', () => ({ default: () => null }));
vi.mock('./requests-flow', () => ({ default: () => null }));
vi.mock('./_hooks/use-redemption-requests', () => ({
  useRedemptionRequests: () => ({ chains: [], count: mocks.requestCount, isPending: false })
}));
vi.mock('./_components/transaction-dialog', () => ({ TransactionDialog: () => null }));
vi.mock('@/components/connected-account', () => ({
  default: ({ children }: { children?: ReactNode }) => children
}));
vi.mock('@/hooks/useAccount', () => ({
  useAccount: () => ({ address: mocks.address, isPending: false, isDisconnected: mocks.address === undefined })
}));

beforeEach(() => {
  mocks.isMobile = true;
  mocks.requestCount = 0;
  mocks.address = '0x000000000000000000000000000000000000dEaD';
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Deposit', () => {
  // Guards the hazard the provider-owned dialog state exists to avoid: with a
  // global atom, a reset effect racing this auto-open on mount could win and
  // leave mobile deep links with the Earn sheet closed. (No shipped build had
  // the bug — the design was chosen over the atom before release.)
  it('auto-opens the Earn dialog for a mobile ?view= deep link', async () => {
    render(<Deposit initialView="redeem" />);

    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  });

  // The modal marks Dynamic's connect sheet inert, so a dialog opened over a
  // disconnected page shows a wallet list that ignores taps.
  it('holds the mobile deep link until a wallet connects, then opens the Earn dialog once', async () => {
    mocks.address = undefined;
    const { rerender } = render(<Deposit initialView="redeem" />);
    expect(screen.queryByRole('dialog')).toBeNull();

    mocks.address = '0x000000000000000000000000000000000000dEaD';
    rerender(<Deposit initialView="redeem" />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
  });

  it('closes the mobile Earn dialog when the wallet disconnects', async () => {
    const { rerender } = render(<Deposit initialView="redeem" />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());

    mocks.address = undefined;
    rerender(<Deposit initialView="redeem" />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('leaves the Earn dialog closed for the same deep link on desktop', () => {
    mocks.isMobile = false;
    render(<Deposit initialView="redeem" />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('offers a Requests tab, badged with how many rows it holds — and unbadged when it holds none', () => {
    mocks.isMobile = false;
    const empty = render(<Deposit initialView="requests" />);
    expect(screen.getByText('Requests')).toBeTruthy();
    expect(screen.queryByText(/requests? pending/)).toBeNull();
    empty.unmount();

    mocks.requestCount = 3;
    const three = render(<Deposit initialView="requests" />);
    // On the tab and on the mobile bar's Redeem button (both render in jsdom).
    expect(screen.getAllByText('(3 requests pending)')).toHaveLength(2);
    expect(screen.getAllByText('3', { ignore: '.sr-only' })).toHaveLength(2);
    three.unmount();

    mocks.requestCount = 1;
    render(<Deposit initialView="requests" />);
    expect(screen.getAllByText('(1 request pending)')).toHaveLength(2);
  });
});
