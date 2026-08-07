// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Deposit from './index';

const mocks = vi.hoisted(() => ({ isMobile: true }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('view=redeem'),
  usePathname: () => '/offerings/global-mca-offerings',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() })
}));

vi.mock('react-responsive', () => ({ useMediaQuery: () => mocks.isMobile }));

// Raw UI TSX does not transform here; the Dialog mock keeps the one behavior
// under test — children render only while isOpen.
vi.mock('@zivoe/ui/icons', () => import('@/test/icon-mocks'));
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
  Dialog: ({ isOpen, children }: { isOpen?: boolean; children: ReactNode }) =>
    isOpen ? <div role="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContentBox: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('./deposit-flow', () => ({ DepositFlow: () => null }));
vi.mock('./redeem-flow', () => ({ default: () => null }));
vi.mock('./_components/transaction-dialog', () => ({ TransactionDialog: () => null }));
vi.mock('@/components/connected-account', () => ({
  default: ({ children }: { children?: ReactNode }) => children
}));

beforeEach(() => {
  mocks.isMobile = true;
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

  it('leaves the Earn dialog closed for the same deep link on desktop', () => {
    mocks.isMobile = false;
    render(<Deposit initialView="redeem" />);

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
