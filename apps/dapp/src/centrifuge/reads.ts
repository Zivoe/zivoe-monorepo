import { type VaultEntity } from './entities';
import { type Investment, type VaultCapacity } from './types';

export async function readVaultCapacity(vault: VaultEntity): Promise<VaultCapacity> {
  const details = await vault.details();

  return { maxDeposit: details.maxDeposit.toBigInt() };
}

export async function readInvestment({
  vault,
  investor
}: {
  vault: VaultEntity;
  investor: `0x${string}`;
}): Promise<Investment> {
  const investment = await vault.investment(investor);

  return {
    pendingRedeemShares: investment.pendingRedeemShares.toBigInt(),
    claimableRedeemAssets: investment.claimableRedeemAssets.toBigInt(),
    claimableRedeemSharesEquivalent: investment.claimableRedeemSharesEquivalent.toBigInt(),
    claimableCancelRedeemShares: investment.claimableCancelRedeemShares.toBigInt(),
    hasPendingCancelRedeemRequest: investment.hasPendingCancelRedeemRequest
  };
}
