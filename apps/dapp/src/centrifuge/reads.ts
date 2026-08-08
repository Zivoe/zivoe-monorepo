import { type VaultEntity } from './entities';
import { type InvestorWhitelist, type RedemptionPosition, type VaultCapacity } from './types';

export async function readVaultCapacity(vault: VaultEntity): Promise<VaultCapacity> {
  const details = await vault.details();

  return { maxDeposit: details.maxDeposit.toBigInt() };
}

/**
 * Both verdicts come off the same investment read the position uses. The SDK's
 * deposit/redeem framing stops here with the rest of its vocabulary: those
 * names describe one caller each, while the underlying transfer checks gate
 * more than that (see InvestorWhitelist).
 */
export async function readInvestorWhitelist({
  vault,
  investor
}: {
  vault: VaultEntity;
  investor: `0x${string}`;
}): Promise<InvestorWhitelist> {
  const investment = await vault.investment(investor);

  return {
    canReceiveShares: investment.isAllowedToDeposit,
    canRequestRedemption: investment.isAllowedToRedeem
  };
}

/** The SDK's `investment` vocabulary survives only here, at the SDK boundary. */
export async function readRedemptionPosition({
  vault,
  investor
}: {
  vault: VaultEntity;
  investor: `0x${string}`;
}): Promise<RedemptionPosition> {
  const investment = await vault.investment(investor);

  return {
    pendingRedeemShares: investment.pendingRedeemShares.toBigInt(),
    claimableRedeemAssets: investment.claimableRedeemAssets.toBigInt(),
    claimableRedeemSharesEquivalent: investment.claimableRedeemSharesEquivalent.toBigInt(),
    claimableCancelRedeemShares: investment.claimableCancelRedeemShares.toBigInt(),
    hasPendingCancelRedeemRequest: investment.hasPendingCancelRedeemRequest
  };
}
