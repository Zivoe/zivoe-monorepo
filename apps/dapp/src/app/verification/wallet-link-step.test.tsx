// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type MembershipSummary } from '@/server/wallet-link/wallet-link-membership';
import { type LinkedAddress } from '@/server/wallet-link/wallet-link-view';

import { WalletLinkStep } from './wallet-link-step';

const ADDRESS = '0x4b7E5A1f9c2D6e8A0b3C4d5E6f7A8b9C0d1E2f3A';
const LOWER = ADDRESS.toLowerCase();
const OTHER = '0x881500000000000000000000000000000000e9e6';

/** What the hooks and actions answer; each test sets the fields it needs before rendering. */
type Mocks = {
  toast: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  setShowAuthFlow: ReturnType<typeof vi.fn>;
  handleLogOut: ReturnType<typeof vi.fn>;
  signTypedData: ReturnType<typeof vi.fn>;
  issue: ReturnType<typeof vi.fn>;
  complete: ReturnType<typeof vi.fn>;
  switchChain: ReturnType<typeof vi.fn>;
  account: { address: string | undefined; isPending: boolean; isDisconnected: boolean };
  chainId: number | undefined;
  chainalysis: { data: unknown; isPending: boolean; isFetching: boolean; isRiskyAddress: boolean };
  membership: Record<string, MembershipSummary | undefined>;
};

const mocks = vi.hoisted(
  (): Mocks => ({
    toast: vi.fn(),
    list: vi.fn(),
    setShowAuthFlow: vi.fn(),
    handleLogOut: vi.fn(async () => undefined),
    signTypedData: vi.fn(async () => '0xsig'),
    issue: vi.fn(),
    complete: vi.fn(),
    switchChain: vi.fn(),
    account: { address: undefined, isPending: false, isDisconnected: true },
    chainId: 11155111,
    chainalysis: { data: undefined, isPending: false, isFetching: false, isRiskyAddress: false },
    membership: {}
  })
);

vi.mock('@zivoe/ui/icons', async () => (await import('@/test/icon-mocks')).ICON_BARREL_MOCK);
vi.mock('@zivoe/ui/core/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>
}));
vi.mock('@zivoe/ui/core/button', () => ({
  Button: ({
    children,
    onPress,
    isDisabled,
    isPending,
    pendingContent,
    'aria-label': ariaLabel
  }: {
    children: ReactNode;
    onPress?: () => void;
    isDisabled?: boolean;
    isPending?: boolean;
    pendingContent?: ReactNode;
    'aria-label'?: string;
  }) => (
    <button type="button" onClick={onPress} disabled={Boolean(isDisabled) || Boolean(isPending)} aria-label={ariaLabel}>
      {isPending && pendingContent ? pendingContent : children}
    </button>
  )
}));
vi.mock('@zivoe/ui/core/link', () => {
  const Anchor = ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>;
  return { Link: Anchor, NextLink: Anchor };
});
vi.mock('@zivoe/ui/core/select', () => ({ SelectTrigger: () => null }));
vi.mock('@zivoe/ui/core/tooltip', () => ({
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipFocusable: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <span role="tooltip">{children}</span>
}));
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: mocks.toast, Toaster: () => null }));
vi.mock('@sentry/nextjs', () => ({ captureException: vi.fn() }));
vi.mock('@dynamic-labs/ethereum', () => ({ isEthereumWallet: () => true }));
vi.mock('@dynamic-labs/wallet-book', () => ({ WalletIcon: () => null }));
vi.mock('@dynamic-labs/sdk-react-core', () => ({
  useDynamicContext: () => ({
    primaryWallet: mocks.account.address
      ? {
          key: 'metamask',
          connector: { key: 'metamask', name: 'MetaMask' },
          getWalletClient: async () => ({ signTypedData: mocks.signTypedData })
        }
      : null,
    setShowAuthFlow: mocks.setShowAuthFlow,
    handleLogOut: mocks.handleLogOut
  })
}));
vi.mock('wagmi', () => ({
  useConnection: () => ({ chainId: mocks.chainId }),
  useSwitchChain: () => ({ mutate: mocks.switchChain, isPending: false })
}));
vi.mock('@/hooks/useAccount', () => ({ useAccount: () => mocks.account }));
vi.mock('@/hooks/useChainalysis', () => ({ useChainalysis: () => mocks.chainalysis }));
vi.mock('@/server/actions/wallet-link', () => ({
  listWalletLinks: mocks.list,
  issueWalletLinkChallenge: mocks.issue,
  completeWalletLink: mocks.complete
}));
vi.mock('./use-address-membership', () => ({ useAddressesMembership: () => mocks.membership }));

const linked = (overrides: Partial<LinkedAddress> = {}): LinkedAddress => ({
  id: 'link_1',
  address: LOWER as LinkedAddress['address'],
  signedAt: new Date(),
  wasWhitelisted: false,
  ...overrides
});

const typedData = {
  domain: { name: 'Zivoe Verification', version: '1', chainId: 11155111 },
  types: { WalletLink: [] },
  primaryType: 'WalletLink',
  message: {
    statement: 's',
    account: 'a@b.c',
    wallet: LOWER,
    nonce: `0x${'00'.repeat(32)}`,
    issuedAt: 1_700_000_000,
    expiresAt: 1_700_604_800
  }
};

const USER_ID = 'user_1';

/** The step over the cache the page seeds on the server: fresh, so nothing is re-read on mount. */
function renderStep(links: Array<LinkedAddress> = []) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(['WALLET_LINKS', USER_ID], links);
  const tree = () => (
    <QueryClientProvider client={client}>
      <WalletLinkStep userId={USER_ID} />
    </QueryClientProvider>
  );
  const view = render(tree());
  /** Renders again as a wallet event would, so the hooks' mocks are read anew. */
  return { ...view, rerenderStep: () => view.rerender(tree()) };
}

const NOT_MEMBER: MembershipSummary = { status: 'pending', memberOn: 0, total: 2, unknown: 0 };
const PARTIAL: MembershipSummary = { status: 'partial', memberOn: 1, total: 2, unknown: 0 };
const WHITELISTED: MembershipSummary = { status: 'whitelisted', memberOn: 2, total: 2, unknown: 0 };

/** A clean wallet on a supported chain, a member nowhere unless the test says otherwise. */
const connect = (address = ADDRESS, summary: MembershipSummary = NOT_MEMBER) => {
  mocks.account = { address, isPending: false, isDisconnected: false };
  mocks.chainalysis = { data: { risk: 'Low' }, isPending: false, isFetching: false, isRiskyAddress: false };
  mocks.membership = { ...mocks.membership, [address.toLowerCase()]: summary };
};

const SIGN = 'Sign to request whitelist';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.account = { address: undefined, isPending: false, isDisconnected: true };
  mocks.chainId = 11155111;
  mocks.chainalysis = { data: undefined, isPending: true, isFetching: false, isRiskyAddress: false };
  mocks.membership = {};
});
afterEach(cleanup);

describe('the connected wallet', () => {
  it('offers Connect wallet and nothing else while no wallet is connected', () => {
    renderStep();

    fireEvent.click(screen.getByRole('button', { name: 'Connect wallet' }));

    expect(mocks.setShowAuthFlow).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
  });

  it('commits to nothing while the wallet SDK is still loading', () => {
    mocks.account = { address: undefined, isPending: true, isDisconnected: false };

    renderStep();

    expect(screen.getByText('Loading wallet…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect wallet' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Connected wallet' })).toBeNull();
  });

  it('claims nothing about the whitelist until the chains have answered', () => {
    connect();
    mocks.membership = {};

    renderStep([linked()]);

    expect(screen.getByText('Loading wallet…')).toBeTruthy();
    expect(screen.queryByText('Whitelist pending')).toBeNull();
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
  });

  it('waits for Chainalysis before offering a signature', () => {
    connect();
    mocks.chainalysis = { data: undefined, isPending: true, isFetching: false, isRiskyAddress: false };

    renderStep();

    // The same placeholder as the wallet SDK's load: the card settles once, on the answer.
    expect(screen.getByText('Loading wallet…')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Connected wallet' })).toBeNull();
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
  });

  it('never offers a signature for a flagged address, only the way out', async () => {
    connect();
    mocks.chainalysis = { ...mocks.chainalysis, data: { risk: 'Severe' }, isRiskyAddress: true };

    renderStep();

    expect(screen.getByText("This address can't be whitelisted.")).toBeTruthy();
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Disconnect' }));
    expect(mocks.handleLogOut).toHaveBeenCalledTimes(1);
    // The button is on its way out with the wallet; the card's heading takes the focus it held.
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Connected wallet' })));
    expect(mocks.issue).not.toHaveBeenCalled();
  });

  it('holds the placeholder while the wallet’s chain is not known yet, never asking to switch', () => {
    connect();
    mocks.chainId = undefined;

    renderStep();

    expect(screen.getByText('Loading wallet…')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Switch network' })).toBeNull();
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
  });

  it('asks for a supported network before a signature when the wallet sits elsewhere', () => {
    connect();
    mocks.chainId = 1;

    renderStep();

    fireEvent.click(screen.getByRole('button', { name: 'Switch network' }));

    expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 11155111 });
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
  });

  it('shows a whitelisted wallet as whitelisted with nothing to sign, whoever requested it', () => {
    // Another account's request, or an investor from before the step existed: the chain is all that is asked.
    connect(ADDRESS, WHITELISTED);
    mocks.chainId = 1;

    renderStep();

    expect(screen.getByText('Whitelisted')).toBeTruthy();
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Switch network' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Disconnect' })).toBeTruthy();
  });

  it('offers the request for a wallet whitelisted on some chains only, and says how far it is', () => {
    connect(ADDRESS, PARTIAL);

    renderStep();

    expect(screen.getByRole('img', { name: 'Not whitelisted, Whitelisted on 1 of 2 chains' })).toBeTruthy();
    expect(screen.getByRole('button', { name: SIGN })).toBeTruthy();
  });

  it('shows a wallet this account requested as pending, with nothing more to sign', () => {
    connect(ADDRESS, PARTIAL);

    renderStep([linked()]);

    expect(screen.getByRole('img', { name: 'Whitelist pending, Whitelisted on 1 of 2 chains' })).toBeTruthy();
    expect(
      screen.getByText(/Whitelist requested just now\. We whitelist new addresses within one business day/)
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
  });

  it('sends a wallet that was whitelisted and no longer is to the team, promising no email', () => {
    connect(ADDRESS, PARTIAL);

    renderStep([linked({ wasWhitelisted: true })]);

    expect(screen.getByRole('img', { name: 'Not whitelisted, Whitelisted on 1 of 2 chains' })).toBeTruthy();
    expect(screen.getByText(/was whitelisted and no longer is/)).toBeTruthy();
    expect(screen.queryByText(/within one business day/)).toBeNull();
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
  });

  it('looks at the connected wallet only: a request for another address changes nothing', () => {
    connect();

    renderStep([linked({ address: OTHER })]);

    expect(screen.getByText('Not whitelisted')).toBeTruthy();
    expect(screen.getByRole('button', { name: SIGN })).toBeTruthy();
  });

  it('issues, signs the exact challenge with bigint timestamps, completes, and shows the request', async () => {
    connect();
    mocks.issue.mockResolvedValue({ ok: true, value: { linkId: 'link_1', typedData } });
    mocks.complete.mockResolvedValue({ ok: true, value: linked() });

    renderStep();
    fireEvent.click(screen.getByRole('button', { name: SIGN }));

    await waitFor(() => expect(mocks.complete).toHaveBeenCalledWith({ address: ADDRESS, signature: '0xsig' }));
    expect(mocks.issue).toHaveBeenCalledWith({
      address: ADDRESS,
      chainId: 11155111,
      walletType: 'metamask',
      walletName: 'MetaMask'
    });
    expect(mocks.signTypedData).toHaveBeenCalledWith({
      account: ADDRESS,
      domain: typedData.domain,
      types: typedData.types,
      primaryType: 'WalletLink',
      message: { ...typedData.message, issuedAt: 1_700_000_000n, expiresAt: 1_700_604_800n }
    });

    // The card reads the address as requested at once.
    expect(await screen.findByText('Whitelist pending')).toBeTruthy();
    expect(screen.getByText(/within one business day/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: SIGN })).toBeNull();
    expect(mocks.toast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success', title: 'Whitelist requested' })
    );
    // The requests are the cache's now: the action's answer was written into it, nothing was re-read.
    expect(mocks.list).not.toHaveBeenCalled();
    // The sign button is gone; focus lands on the card that now shows the request.
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Connected wallet' }));
  });

  it('returns to the signature after the wallet declines, and says so once', async () => {
    connect();
    mocks.issue.mockResolvedValue({ ok: true, value: { linkId: 'link_1', typedData } });
    mocks.signTypedData.mockRejectedValueOnce(Object.assign(new Error('User rejected the request.'), { code: 4001 }));

    renderStep();
    fireEvent.click(screen.getByRole('button', { name: SIGN }));

    await waitFor(() =>
      expect(mocks.toast).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'warning', title: 'Signature declined' })
      )
    );
    expect(mocks.complete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: SIGN })).toBeTruthy();
  });

  it('reads the requests through the action when the cache holds none, and keeps a write over an older payload', async () => {
    connect();
    mocks.list.mockResolvedValue({ ok: true, value: [] });
    mocks.issue.mockResolvedValue({ ok: true, value: { linkId: 'link_1', typedData } });
    const request = linked();
    mocks.complete.mockResolvedValue({ ok: true, value: request });
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <WalletLinkStep userId={USER_ID} />
      </QueryClientProvider>
    );

    const sign = await screen.findByRole('button', { name: SIGN });
    expect(mocks.list).toHaveBeenCalledTimes(1);

    // The page's payload can carry a later stamp than this browser's clock; the write still outranks it.
    const key = ['WALLET_LINKS', USER_ID];
    client.setQueryData(key, [], { updatedAt: Date.now() + 120_000 });
    const seededAt = client.getQueryState(key)!.dataUpdatedAt;
    fireEvent.click(sign);

    await waitFor(() => expect(client.getQueryData(key)).toEqual([request]));
    expect(client.getQueryState(key)!.dataUpdatedAt).toBeGreaterThan(seededAt);
  });

  it('reads the requests again when one is refused, so an address requested in another tab shows as requested', async () => {
    connect();
    mocks.issue.mockResolvedValue({ ok: false, error: { code: 'already_linked' } });
    mocks.list.mockResolvedValue({ ok: true, value: [linked()] });

    renderStep();
    fireEvent.click(screen.getByRole('button', { name: SIGN }));

    expect(await screen.findByText('Whitelist pending')).toBeTruthy();
    expect(mocks.list).toHaveBeenCalledTimes(1);
  });
});
