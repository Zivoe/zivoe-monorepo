import { type CentrifugeVaultEntity } from './entities';
import { type CentrifugeVaultCapacity, type InvestorWhitelist, type RedemptionPosition } from './types';

export async function readCentrifugeVaultCapacity(
  centrifugeVault: CentrifugeVaultEntity
): Promise<CentrifugeVaultCapacity> {
  const details = await centrifugeVault.details();

  return { maxDeposit: details.maxDeposit.toBigInt() };
}

/**
 * Both verdicts come off the same investment read the position uses. The SDK's
 * deposit/redeem framing stops here with the rest of its vocabulary: those
 * names describe one caller each, while the underlying transfer checks gate
 * more than that (see InvestorWhitelist).
 */
export async function readInvestorWhitelist({
  centrifugeVault,
  investor
}: {
  centrifugeVault: CentrifugeVaultEntity;
  investor: `0x${string}`;
}): Promise<InvestorWhitelist> {
  const investment = await centrifugeVault.investment(investor);

  return {
    canReceiveShares: investment.isAllowedToDeposit,
    canRequestRedemption: investment.isAllowedToRedeem
  };
}

/** The SDK's `investment` vocabulary survives only here, at the SDK boundary. */
export async function readRedemptionPosition({
  centrifugeVault,
  investor
}: {
  centrifugeVault: CentrifugeVaultEntity;
  investor: `0x${string}`;
}): Promise<RedemptionPosition> {
  const investment = await centrifugeVault.investment(investor);

  return {
    pendingRedeemShares: investment.pendingRedeemShares.toBigInt(),
    claimableRedeemAssets: investment.claimableRedeemAssets.toBigInt(),
    claimableRedeemSharesEquivalent: investment.claimableRedeemSharesEquivalent.toBigInt(),
    claimableCancelRedeemShares: investment.claimableCancelRedeemShares.toBigInt(),
    hasPendingCancelRedeemRequest: investment.hasPendingCancelRedeemRequest
  };
}
