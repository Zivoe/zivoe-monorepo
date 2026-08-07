import { type VaultEntity } from './entities';
import { type RedemptionPosition, type VaultCapacity } from './types';

export async function readVaultCapacity(vault: VaultEntity): Promise<VaultCapacity> {
  const details = await vault.details();

  return { maxDeposit: details.maxDeposit.toBigInt() };
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
