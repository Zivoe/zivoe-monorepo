import * as Sentry from '@sentry/nextjs';
import { type Address, parseAbi } from 'viem';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { type CentrifugeVaultEntity } from './entities';
import {
  type CentrifugeVaultCapacity,
  type InvestorAccess,
  type InvestorRestriction,
  type RedemptionPosition
} from './types';

export async function readCentrifugeVaultCapacity(
  centrifugeVault: CentrifugeVaultEntity
): Promise<CentrifugeVaultCapacity> {
  const details = await centrifugeVault.details();

  return { maxDeposit: details.maxDeposit.toBigInt() };
}

const SHARE_TOKEN_HOOK_ABI = parseAbi(['function hook() view returns (address)']);

// The two facts the verdicts collapse together. A hook that predates the
// memberlist (FreezeOnly, FreelyTransferable) answers neither, which is one
// of the ways the restriction lands on 'unknown'.
const TRANSFER_HOOK_ABI = parseAbi([
  'function isFrozen(address token, address user) view returns (bool)',
  'function isMember(address token, address user) view returns (bool isValid, uint64 validUntil)'
]);

/** The narrow slice of a viem client this module reads through — keeps viem's generics out of the signature. */
type ContractReader = {
  readContract(args: {
    address: Address;
    abi: ReadonlyArray<unknown>;
    functionName: string;
    args: ReadonlyArray<unknown>;
  }): Promise<unknown>;
};

/**
 * Both verdicts come off the same investment read the position uses. The SDK's
 * deposit/redeem framing stops here with the rest of its vocabulary: those
 * names describe one caller each, while the underlying transfer checks gate
 * more than that (see InvestorAccess).
 *
 * The restriction is a second, separate question — asked only when a verdict
 * is false, so an admitted wallet costs nothing extra, and asked inside this
 * same read so the flows see one verdict arrive at one moment rather than a
 * label that corrects itself a beat later.
 */
export async function readInvestorAccess({
  centrifugeVault,
  investor,
  client,
  shareTokenAddress
}: {
  centrifugeVault: CentrifugeVaultEntity;
  investor: `0x${string}`;
  client: ContractReader;
  shareTokenAddress: Address;
}): Promise<InvestorAccess> {
  const investment = await centrifugeVault.investment(investor);

  const access = {
    canReceiveShares: investment.isAllowedToDeposit,
    canRequestRedemption: investment.isAllowedToRedeem
  };

  if (access.canReceiveShares && access.canRequestRedemption) return { ...access, restriction: 'none' };

  return { ...access, restriction: await readRestriction({ client, shareTokenAddress, investor }) };
}

/**
 * Why the hook refused, read straight off the hook contract — the SDK exposes
 * no freeze query, and its own `isMember` swallows read failures into a plain
 * `false`, which would manufacture the exact false verdict this exists to
 * prevent. Every failure path lands on 'unknown' instead.
 */
async function readRestriction({
  client,
  shareTokenAddress,
  investor
}: {
  client: ContractReader;
  shareTokenAddress: Address;
  investor: `0x${string}`;
}): Promise<InvestorRestriction> {
  let restriction: InvestorRestriction = 'unknown';

  try {
    const hook = (await client.readContract({
      address: shareTokenAddress,
      abi: SHARE_TOKEN_HOOK_ABI,
      functionName: 'hook',
      args: []
    })) as Address;

    const [isFrozen, [isMember, validUntil]] = (await Promise.all([
      client.readContract({
        address: hook,
        abi: TRANSFER_HOOK_ABI,
        functionName: 'isFrozen',
        args: [shareTokenAddress, investor]
      }),
      client.readContract({
        address: hook,
        abi: TRANSFER_HOOK_ABI,
        functionName: 'isMember',
        args: [shareTokenAddress, investor]
      })
    ])) as [boolean, [boolean, bigint]];

    // `validUntil` can only ever be zero for a wallet the hook has never been
    // told about: updateMember refuses a timestamp already in the past, and
    // block.timestamp is never zero, so no admission can write one.
    restriction = isFrozen ? 'frozen' : isMember ? 'unknown' : validUntil === 0n ? 'not-member' : 'membership-expired';
  } catch {
    // Falls through to the report below — 'unknown' already.
  }

  // Both of these mean the operator picture is not what we expect: a hook we
  // cannot interrogate or a refusal it does not explain ('unknown'), or
  // admissions that are quietly lapsing ('membership-expired'), which would
  // otherwise read as an onboarding problem rather than an expiry one.
  if (restriction === 'unknown' || restriction === 'membership-expired')
    Sentry.captureMessage(`Investor access blocked with restriction "${restriction}"`, {
      level: 'warning',
      tags: { source: 'READ', restriction },
      extra: { shareTokenAddress, investor }
    });

  return restriction;
}

/**
 * Returned Shares alone — the one bucket the claim guards check, because the
 * SDK's aggregate claim empties it before paying out redemption USDC. Reads the
 * same SDK position as readRedemptionPosition without its escrow comparison:
 * a guard runs on every claim click and acts on nothing else.
 */
export async function readReturnedShares({
  centrifugeVault,
  investor
}: {
  centrifugeVault: CentrifugeVaultEntity;
  investor: `0x${string}`;
}): Promise<bigint> {
  const investment = await centrifugeVault.investment(investor);

  return investment.claimableCancelRedeemShares.toBigInt();
}

const UNFUNDED_CLAIM_ABI = parseAbi([
  'function maxWithdraw(address owner) view returns (uint256 assets)',
  'function holding(bytes16 scId, address asset, uint256 tokenId) view returns (uint128 total, uint128 reserved)'
]);

/**
 * The SDK's `investment` vocabulary survives only here, at the SDK boundary.
 *
 * The SDK zeroes every claim on a spoke whose pool escrow is reserved beyond
 * its holdings — its escrow check in Vault.investment reduces to
 * `reserved > total`, pool-wide rather than per claim — so a settled
 * redemption on such a spoke reads exactly like "no position". The same two
 * facts are read here to name the Unfunded Claim the SDK hides. Read off the
 * chain through the app's client rather than compared against the SDK's
 * number: the SDK rides its own client, so the two can answer from different
 * blocks, and the Centrifuge vault's `maxWithdraw` is permissioned (a frozen
 * wallet reads 0 where the SDK's raw struct does not) — the claim path uses
 * that permissioned view, so it is the one to name. Diagnostic only: a failed
 * read leaves the position intact with no Unfunded Claim instead of taking
 * the whole position down — reported, since silence here is the blind tab
 * this exists to end.
 */
export async function readRedemptionPosition({
  centrifugeVault,
  investor,
  client,
  chain,
  shareClassId,
  assetAddress
}: {
  centrifugeVault: CentrifugeVaultEntity;
  investor: `0x${string}`;
  client: ContractReader;
  /** Tags the report — an Unfunded Claim is an operations gap on one spoke. */
  chain: CentrifugeChain;
  /** The escrow's holding is keyed by share class and deposit asset. */
  shareClassId: `0x${string}`;
  assetAddress: Address;
}): Promise<RedemptionPosition> {
  const [investment, unfundedClaim] = await Promise.all([
    centrifugeVault.investment(investor),
    readUnfundedClaim({ centrifugeVault, investor, client, shareClassId, assetAddress }).catch((error: unknown) => {
      Sentry.captureException(error, {
        tags: { source: 'READ', chain },
        extra: { centrifugeVaultAddress: centrifugeVault.address, investor, read: 'unfundedClaim' }
      });
      return 0n;
    })
  ]);

  const claimableRedeemAssets = investment.claimableRedeemAssets.toBigInt();
  // The SDK and this read may answer from different blocks: a claim the SDK
  // still offers wins, so the claimable and unfunded strips never render together.
  const unfundedClaimableAssets = claimableRedeemAssets === 0n ? unfundedClaim : 0n;

  // An exception, not a warning: the investor is owed funds they cannot
  // collect until operations act. Reported by every read that sees it — reads
  // are mount- and transaction-driven, and the fingerprint folds them into one
  // issue per position.
  if (unfundedClaimableAssets > 0n)
    Sentry.captureException(new Error('Settled redemption cannot be claimed: pool escrow underfunded'), {
      tags: { source: 'READ', chain },
      fingerprint: ['unfunded-claim', chain, centrifugeVault.address, investor],
      extra: {
        centrifugeVaultAddress: centrifugeVault.address,
        investor,
        unfundedClaimableAssets: unfundedClaimableAssets.toString()
      }
    });

  return {
    pendingRedeemShares: investment.pendingRedeemShares.toBigInt(),
    claimableRedeemAssets,
    claimableRedeemSharesEquivalent: investment.claimableRedeemSharesEquivalent.toBigInt(),
    unfundedClaimableAssets,
    claimableCancelRedeemShares: investment.claimableCancelRedeemShares.toBigInt(),
    hasPendingCancelRedeemRequest: investment.hasPendingCancelRedeemRequest
  };
}

/**
 * Settled USDC the Centrifuge vault would pay this wallet, when the chain's
 * pool escrow is reserved beyond its holdings — zero otherwise. Both reads go
 * through one client, so a claim landing between them cannot fabricate a
 * shortfall: a claim only ever lowers `reserved`.
 */
async function readUnfundedClaim({
  centrifugeVault,
  investor,
  client,
  shareClassId,
  assetAddress
}: {
  centrifugeVault: CentrifugeVaultEntity;
  investor: `0x${string}`;
  client: ContractReader;
  shareClassId: `0x${string}`;
  assetAddress: Address;
}): Promise<bigint> {
  const escrowAddress = (await centrifugeVault.pool._escrow()) as Address;

  const [maxWithdraw, [total, reserved]] = (await Promise.all([
    client.readContract({
      address: centrifugeVault.address,
      abi: UNFUNDED_CLAIM_ABI,
      functionName: 'maxWithdraw',
      args: [investor]
    }),
    client.readContract({
      address: escrowAddress,
      abi: UNFUNDED_CLAIM_ABI,
      functionName: 'holding',
      args: [shareClassId, assetAddress, 0n]
    })
  ])) as [bigint, [bigint, bigint]];

  return maxWithdraw > 0n && reserved > total ? maxWithdraw : 0n;
}
