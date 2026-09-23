// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { type PortfolioModel } from '@/portfolio/model';

import Portfolio from './portfolio';
import { PREVIEW_WALLETS } from './wallet-preview';

const mocks = vi.hoisted(
  (): {
    account: `0x${string}` | undefined;
    portfolio: ReturnType<typeof vi.fn>;
    activity: ReturnType<typeof vi.fn>;
  } => ({
    account: '0x1111111111111111111111111111111111111111',
    portfolio: vi.fn(),
    activity: vi.fn()
  })
);
vi.mock('@/hooks/useAccount', () => ({ useAccount: () => ({ address: mocks.account }) }));
vi.mock('@/portfolio/use-portfolio', () => ({ usePortfolio: (...args: Array<unknown>) => mocks.portfolio(...args) }));
vi.mock('@/components/connected-account', () => ({ default: () => <button>Connect wallet</button> }));
vi.mock('@/components/hero/asset', () => ({ HeroAsset: () => null }));
vi.mock('@/components/zivoe-vault-icons', () => ({ TokenIconStack: () => null }));
vi.mock('./chart', () => ({ WalletChart: () => null }));
vi.mock('./holdings', () => ({ Holdings: () => null, Allocation: () => null }));
vi.mock('./requests', () => ({ Requests: () => null }));
vi.mock('./quick-actions', () => ({ QuickActions: () => null }));
vi.mock('./activity', () => ({
  Activity: (props: unknown) => {
    mocks.activity(props);
    return null;
  }
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

function setup() {
  mocks.account = '0x1111111111111111111111111111111111111111';
  mocks.portfolio.mockReturnValue({
    model: { complete: true, holdings: [], totalD18: 0n } satisfies Partial<PortfolioModel>,
    historyQuery: {}
  });
}

it('previews all six wallets and returns to the connected wallet without attributing the user profile to a holder', () => {
  setup();
  vi.stubEnv('NODE_ENV', 'development');
  render(<Portfolio identities={[]} userInfo={<span>Connected user profile</span>} />);
  expect(screen.getByText('Connected user profile')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'My wallet' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getAllByRole('button', { name: /^Preview 0x/ })).toHaveLength(6);

  for (const address of PREVIEW_WALLETS) {
    const button = screen.getByRole('button', { name: `Preview ${address}` });
    fireEvent.click(button);
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(mocks.portfolio).toHaveBeenLastCalledWith([], address);
    expect(mocks.activity).toHaveBeenLastCalledWith(expect.objectContaining({ accountAddress: address }));
    expect(screen.getByRole('heading', { name: /Portfolio preview/ })).toBeTruthy();
    expect(screen.queryByText('Connected user profile')).toBeNull();
  }

  fireEvent.click(screen.getByRole('button', { name: 'My wallet' }));
  expect(mocks.portfolio).toHaveBeenLastCalledWith([], mocks.account);
  expect(mocks.activity).toHaveBeenLastCalledWith(expect.objectContaining({ accountAddress: mocks.account }));
  expect(screen.getByText('Connected user profile')).toBeTruthy();
});

it('allows a read-only preview while disconnected and keeps the wallet selector out of production', () => {
  setup();
  mocks.account = undefined;
  vi.stubEnv('NODE_ENV', 'development');
  const { rerender } = render(<Portfolio identities={[]} userInfo={null} />);
  expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: `Preview ${PREVIEW_WALLETS[0]}` }));
  expect(mocks.portfolio).toHaveBeenLastCalledWith([], PREVIEW_WALLETS[0]);
  expect(screen.queryByRole('button', { name: 'Connect wallet' })).toBeNull();

  vi.stubEnv('NODE_ENV', 'production');
  rerender(<Portfolio identities={[]} userInfo={null} />);
  expect(screen.queryByRole('group', { name: 'Portfolio wallet preview' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Connect wallet' })).toBeTruthy();
});
