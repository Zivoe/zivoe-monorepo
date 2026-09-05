// @vitest-environment jsdom
import { type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FIXTURE_IDENTITY } from '@/test/fixtures';

import { useCentrifugeVaultCapacity, useDepositPreview, useInvestorAccess, useRedemptionPosition } from './index';

const getCentrifugeVault = vi.hoisted(() => vi.fn());
vi.mock('./client', () => ({ getCentrifugeVault }));

const readContract = vi.hoisted(() => vi.fn());
vi.mock('wagmi', () => ({ usePublicClient: () => ({ readContract }) }));

const useAccount = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useAccount', () => ({ useAccount }));

const sentryCapture = vi.hoisted(() => vi.fn());
const sentryCaptureException = vi.hoisted(() => vi.fn());
vi.mock('@sentry/nextjs', () => ({ captureMessage: sentryCapture, captureException: sentryCaptureException }));

// The public entry also exports the transaction hooks, whose UI toast import
// does not transform under vitest; these tests never render toasts.
vi.mock('@zivoe/ui/core/sonner', () => ({ toast: vi.fn(), Toaster: () => null }));

const INVESTOR = '0xa28ef80d690844b586e192690d8fcdaecfd0281e';

const CENTRIFUGE_VAULT = FIXTURE_IDENTITY.centrifugeVault;

function balance(value: bigint, decimals = 18) {
  return { toBigInt: () => value, decimals };
}

// The access fixture stays in the SDK's own deposit/redeem vocabulary —
// the rename to canReceiveShares/canRequestRedemption happens in the read, and
// a fixture written in domain terms would assert the mapping against itself.
function fakeCentrifugeVault({
  whitelist = { isAllowedToDeposit: true, isAllowedToRedeem: true },
  claimableRedeemAssets = 150_000000n
} = {}) {
  return {
    address: CENTRIFUGE_VAULT.address,
    asyncRequestManagerAddress: MANAGER_ADDRESS,
    pool: { _escrow: () => Promise.resolve(ESCROW_ADDRESS) },
    details: () => Promise.resolve({ maxDeposit: balance(5_000_000000n, 6) }),
    investment: () =>
      Promise.resolve({
        ...whitelist,
        shareBalance: balance(101_000000000000000000n),
        pendingRedeemShares: balance(200_000000000000000000n),
        claimableRedeemAssets: balance(claimableRedeemAssets, 6),
        claimableRedeemSharesEquivalent: balance(140_000000000000000000n),
        claimableCancelRedeemShares: balance(60_000000000000000000n),
        hasPendingCancelRedeemRequest: false
      })
  };
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  };
}

// The share token's transfer hook, as the restriction read sees it. An Error
// stands in for a hook that cannot be reached or does not answer at all.
const HOOK_ADDRESS = '0x00000000000000000000000000000000000000aa';
let hookAnswers: { isFrozen: boolean; isMember: boolean; validUntil: bigint } | Error;
// The Unfunded Claim diagnostics: the request manager's settled amount for the
// wallet and the pool escrow's holding on the chain — a funded escrow by
// default. An Error stands in for an RPC that will not answer.
const MANAGER_ADDRESS = '0x00000000000000000000000000000000000000bb';
const ESCROW_ADDRESS = '0x00000000000000000000000000000000000000ee';
let settledAssetsAnswer: bigint | Error;
let escrowHolding: { total: bigint; reserved: bigint };

beforeEach(() => {
  vi.resetAllMocks();
  getCentrifugeVault.mockImplementation(() => Promise.resolve(fakeCentrifugeVault()));
  hookAnswers = { isFrozen: false, isMember: true, validUntil: 4294967295n };
  settledAssetsAnswer = 150_000000n;
  escrowHolding = { total: 1_000_000000n, reserved: 150_000000n };
  readContract.mockImplementation(({ functionName }: { functionName: string }) => {
    if (functionName === 'investments')
      return settledAssetsAnswer instanceof Error
        ? Promise.reject(settledAssetsAnswer)
        : Promise.resolve([0n, settledAssetsAnswer, 0n, 0n, 0n, 0n, 0n, 0n, false, false]);
    if (functionName === 'holding') return Promise.resolve([escrowHolding.total, escrowHolding.reserved]);
    // The claim verdict follows the protocol: a freeze blocks the burn against
    // escrow, membership does not; an unreachable hook is no verdict.
    if (functionName === 'checkTransferRestriction')
      return hookAnswers instanceof Error ? Promise.reject(hookAnswers) : Promise.resolve(!hookAnswers.isFrozen);
    // previewDeposit — the only read that is not part of the hook interrogation.
    if (!['hook', 'isFrozen', 'isMember'].includes(functionName)) return Promise.resolve(50_000000000000000000n);
    if (hookAnswers instanceof Error) return Promise.reject(hookAnswers);
    if (functionName === 'hook') return Promise.resolve(HOOK_ADDRESS);
    if (functionName === 'isFrozen') return Promise.resolve(hookAnswers.isFrozen);
    return Promise.resolve([hookAnswers.isMember, hookAnswers.validUntil]);
  });
  useAccount.mockReturnValue({ isPending: false, isDisconnected: false, address: INVESTOR });
});

function blockedCentrifugeVault() {
  return Promise.resolve(fakeCentrifugeVault({ whitelist: { isAllowedToDeposit: false, isAllowedToRedeem: false } }));
}

describe('useCentrifugeVaultCapacity', () => {
  it("reads the handed share class's Centrifuge vault and caches under its key", async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useCentrifugeVaultCapacity({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ maxDeposit: 5_000_000000n });
    expect(getCentrifugeVault).toHaveBeenCalledWith(CENTRIFUGE_VAULT);
    expect(queryClient.getQueryData(['CENTRIFUGE', 'zfix', 'VAULT_CAPACITY', 'sepolia'])).toEqual({
      maxDeposit: 5_000_000000n
    });
  });

  // The reason the key carries the chain: one share class carries one
  // Centrifuge vault per chain, and each answers maxDeposit for itself. A
  // class-only key would serve the first chain's capacity for the second.
  it("keeps two chains' Centrifuge vaults of one share class in separate cache entries", async () => {
    const { queryClient, wrapper } = createWrapper();
    const otherChainCentrifugeVault = {
      ...CENTRIFUGE_VAULT,
      chain: 'base-sepolia',
      chainId: 84532,
      address: '0xbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbcbc'
    } as const;

    const first = renderHook(() => useCentrifugeVaultCapacity({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true));

    getCentrifugeVault.mockImplementation(() =>
      Promise.resolve({ details: () => Promise.resolve({ maxDeposit: balance(9_000_000000n, 6) }) })
    );
    const second = renderHook(() => useCentrifugeVaultCapacity({ centrifugeVault: otherChainCentrifugeVault }), {
      wrapper
    });
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true));

    expect(first.result.current.data).toEqual({ maxDeposit: 5_000_000000n });
    expect(second.result.current.data).toEqual({ maxDeposit: 9_000_000000n });
    expect(queryClient.getQueryData(['CENTRIFUGE', 'zfix', 'VAULT_CAPACITY', 'base-sepolia'])).toEqual({
      maxDeposit: 9_000_000000n
    });
  });
});

describe('useDepositPreview', () => {
  it("quotes shares from the handed Centrifuge vault's previewDeposit and caches under the Centrifuge-vault key", async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useDepositPreview({ centrifugeVault: CENTRIFUGE_VAULT, assets: 100_000000n }), {
      wrapper
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ shares: 50_000000000000000000n });
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: CENTRIFUGE_VAULT.address,
        functionName: 'previewDeposit',
        args: [100_000000n]
      })
    );
    expect(queryClient.getQueryData(['CENTRIFUGE', 'zfix', 'DEPOSIT_PREVIEW', 'sepolia', '100000000'])).toEqual({
      shares: 50_000000000000000000n
    });
  });

  it('does not read for a non-positive amount', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDepositPreview({ centrifugeVault: CENTRIFUGE_VAULT, assets: 0n }), {
      wrapper
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(readContract).not.toHaveBeenCalled();
  });

  it('surfaces a failed contract preview as a query error', async () => {
    readContract.mockRejectedValue(new Error('execution reverted'));

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useDepositPreview({ centrifugeVault: CENTRIFUGE_VAULT, assets: 100_000000n }), {
      wrapper
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useRedemptionPosition', () => {
  it('returns the plain domain fields under the account and Centrifuge-vault key', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      pendingRedeemShares: 200_000000000000000000n,
      claimableRedeemAssets: 150_000000n,
      claimableRedeemSharesEquivalent: 140_000000000000000000n,
      unfundedClaimableAssets: 0n,
      claimableCancelRedeemShares: 60_000000000000000000n,
      hasPendingCancelRedeemRequest: false
    });
    expect(getCentrifugeVault).toHaveBeenCalledWith(CENTRIFUGE_VAULT);
    expect(queryClient.getQueryData(['ACCOUNT', INVESTOR, 'REDEMPTION_POSITION', 'zfix', 'sepolia'])).toBeDefined();
    // A funded escrow: the diagnostics ran and found nothing to name or report.
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: MANAGER_ADDRESS,
        functionName: 'investments',
        args: [CENTRIFUGE_VAULT.address, INVESTOR]
      })
    );
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: ESCROW_ADDRESS,
        functionName: 'holding',
        args: [CENTRIFUGE_VAULT.shareClass.scId, CENTRIFUGE_VAULT.usdc.address, 0n]
      })
    );
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it('names an Unfunded Claim when the escrow is reserved beyond its holdings, and reports it', async () => {
    // The SDK zeroes every claim on such a spoke, so the position reads exactly
    // like "no position" — only the request manager's settled amount and the
    // escrow's holding tell.
    getCentrifugeVault.mockImplementation(() => Promise.resolve(fakeCentrifugeVault({ claimableRedeemAssets: 0n })));
    settledAssetsAnswer = 310_071n;
    escrowHolding = { total: 310_000n, reserved: 310_071n };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ claimableRedeemAssets: 0n, unfundedClaimableAssets: 310_071n });
    expect(sentryCaptureException).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('escrow underfunded') }),
      expect.objectContaining({
        tags: { source: 'READ', chain: 'sepolia' },
        fingerprint: ['unfunded-claim', 'sepolia', CENTRIFUGE_VAULT.address, INVESTOR]
      })
    );
  });

  it('lets a claim the SDK still offers win over the escrow diagnostics', async () => {
    // The SDK answers through its own client, so the two reads can come from
    // different blocks; a claimable amount stands, and nothing is reported.
    escrowHolding = { total: 100_000000n, reserved: 150_000000n };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ claimableRedeemAssets: 150_000000n, unfundedClaimableAssets: 0n });
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it("reads the settled amount off the request manager's struct, never the permissioned view", async () => {
    // The Centrifuge vault's own maxWithdraw reads 0 for a frozen wallet; the
    // struct does not. The amount is owed either way, and the flow layers the
    // freeze on top from InvestorAccess — so this read must not consult it.
    getCentrifugeVault.mockImplementation(() => Promise.resolve(fakeCentrifugeVault({ claimableRedeemAssets: 0n })));
    settledAssetsAnswer = 310_071n;
    escrowHolding = { total: 310_000n, reserved: 310_071n };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.unfundedClaimableAssets).toBe(310_071n);
    expect(readContract).not.toHaveBeenCalledWith(expect.objectContaining({ functionName: 'maxWithdraw' }));
    expect(readContract).not.toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'checkTransferRestriction' })
    );
  });

  it('fails the position when the escrow diagnostics cannot be read', async () => {
    // A failed diagnostic must not become a verified zero: for the one wallet
    // the Unfunded Claim exists for (SDK claimable already clamped to 0) that
    // would be the blind tab again, with no error state to say so. It fails
    // like any other position read, so the query's error path toasts it.
    getCentrifugeVault.mockImplementation(() => Promise.resolve(fakeCentrifugeVault({ claimableRedeemAssets: 0n })));
    const failure = new Error('RPC Request failed');
    settledAssetsAnswer = failure;

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(failure);
    expect(result.current.data).toBeUndefined();
    // Reported once, by the query's own error handling — not a second time here.
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it('fails the position when the SDK escrow lookup the diagnostics depend on rejects', async () => {
    // `_escrow` is an SDK internal (see entities.ts): a rename or a hub-RPC
    // failure lands here, and must surface the same way, not as a silent zero.
    const failure = new Error('_escrow is not a function');
    getCentrifugeVault.mockImplementation(() =>
      Promise.resolve({ ...fakeCentrifugeVault(), pool: { _escrow: () => Promise.reject(failure) } })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBe(failure);
  });

  it('does not read without a connected wallet', () => {
    useAccount.mockReturnValue({ isPending: false, isDisconnected: true, address: undefined });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRedemptionPosition({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCentrifugeVault).not.toHaveBeenCalled();
  });
});

describe('useInvestorAccess', () => {
  it('returns every Centrifuge-vault verdict under the account and Centrifuge-vault key', async () => {
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      canReceiveShares: true,
      canRequestRedemption: true,
      canClaimProceeds: true,
      restriction: 'none'
    });
    expect(getCentrifugeVault).toHaveBeenCalledWith(CENTRIFUGE_VAULT);
    expect(queryClient.getQueryData(['ACCOUNT', INVESTOR, 'INVESTOR_ACCESS', 'zfix', 'sepolia'])).toBeDefined();
  });

  it('does not interrogate the hook while both verdicts allow', async () => {
    // An admitted wallet is the common case and has nothing to explain, so it
    // must not pay for the reason reads.
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(readContract).not.toHaveBeenCalled();
  });

  it('reports a blocked wallet rather than throwing', async () => {
    getCentrifugeVault.mockImplementation(blockedCentrifugeVault);
    hookAnswers = { isFrozen: false, isMember: false, validUntil: 0n };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      canReceiveShares: false,
      canRequestRedemption: false,
      // Membership never gates a claim: proceeds already owed stay reachable.
      canClaimProceeds: true,
      restriction: 'not-member'
    });
  });

  it('keeps the two directions apart rather than collapsing them into one verdict', async () => {
    // The protocol answers these with different calls, and the redeem panel
    // gates different actions on each — a swap here would silently move which
    // buttons a wallet loses once it is no longer whitelisted.
    getCentrifugeVault.mockImplementation(() =>
      Promise.resolve(fakeCentrifugeVault({ whitelist: { isAllowedToDeposit: true, isAllowedToRedeem: false } }))
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.canReceiveShares).toBe(true);
    expect(result.current.data?.canRequestRedemption).toBe(false);
  });

  it('tells a frozen member apart from a wallet that was never admitted', async () => {
    // The whole point of the reason read: the hook short-circuits on freeze
    // before its memberlist branch, so both produce the identical verdicts and
    // only isFrozen separates them.
    getCentrifugeVault.mockImplementation(blockedCentrifugeVault);
    hookAnswers = { isFrozen: true, isMember: true, validUntil: 4294967295n };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.restriction).toBe('frozen');
    // A freeze is the one block the protocol applies to a claim as well.
    expect(result.current.data?.canClaimProceeds).toBe(false);
  });

  it('reports freeze ahead of membership when a wallet is both frozen and unadmitted', async () => {
    // Unfreezing is the only thing that lifts a freeze, so it is the reason
    // worth naming even when membership is also missing.
    getCentrifugeVault.mockImplementation(blockedCentrifugeVault);
    hookAnswers = { isFrozen: true, isMember: false, validUntil: 0n };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.restriction).toBe('frozen');
  });

  it('separates a lapsed admission from one that never happened', async () => {
    // A non-zero validUntil means the hook was told about this wallet once;
    // only a wallet it has never seen reads zero.
    getCentrifugeVault.mockImplementation(blockedCentrifugeVault);
    hookAnswers = { isFrozen: false, isMember: false, validUntil: 1_700_000_000n };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.restriction).toBe('membership-expired');
    expect(sentryCapture).toHaveBeenCalled();
  });

  it('keeps the verdicts when the hook cannot be interrogated', async () => {
    // A hook with no memberlist, or an RPC that will not answer. The verdicts
    // are the gate and must survive intact; only the reason is lost.
    getCentrifugeVault.mockImplementation(blockedCentrifugeVault);
    hookAnswers = new Error('execution reverted');

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      canReceiveShares: false,
      canRequestRedemption: false,
      // A claim verdict that cannot be read is no verdict either.
      canClaimProceeds: true,
      restriction: 'unknown'
    });
    expect(sentryCapture).toHaveBeenCalled();
  });

  it('reports a refusal the hook does not explain rather than inventing one', async () => {
    // An admitted, unfrozen wallet that the Centrifuge vault still refuses is
    // a picture we do not understand — naming it 'not-member' would be a
    // guess, and the wrong one to act on.
    getCentrifugeVault.mockImplementation(blockedCentrifugeVault);
    hookAnswers = { isFrozen: false, isMember: true, validUntil: 4294967295n };

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.restriction).toBe('unknown');
    expect(sentryCapture).toHaveBeenCalled();
  });

  it('does not read without a connected wallet', () => {
    useAccount.mockReturnValue({ isPending: false, isDisconnected: true, address: undefined });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useInvestorAccess({ centrifugeVault: CENTRIFUGE_VAULT }), { wrapper });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getCentrifugeVault).not.toHaveBeenCalled();
  });
});
