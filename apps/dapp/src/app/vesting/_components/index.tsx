'use client';

import { useAccount } from '@/hooks/useAccount';
import { useBlockchainTimestamp } from '@/hooks/useBlockchainTimestamp';
import { useChainalysis } from '@/hooks/useChainalysis';

import { useClaimableAmount } from '../_hooks/useClaimableAmount';
import { useVestingSchedule } from '../_hooks/useVestingSchedule';
import { VestingOverview, VestingOverviewSkeleton } from './vesting-overview';
import { VestingRewards, VestingRewardsSkeleton } from './vesting-rewards';
import { VestingSchedule, VestingScheduleSkeleton } from './vesting-schedule';

export default function VestingComponents() {
  const account = useAccount();
  const chainalysis = useChainalysis();
  const blockchainTimestamp = useBlockchainTimestamp();
  const schedule = useVestingSchedule();
  const claimableAmount = useClaimableAmount();

  const isLoading =
    account.isPending ||
    chainalysis.isFetching ||
    schedule.isLoading ||
    claimableAmount.isLoading ||
    blockchainTimestamp.isLoading;

  if (isLoading)
    return (
      <>
        <div className="flex w-full flex-col gap-6 md:flex-row">
          <VestingOverviewSkeleton />
          <VestingRewardsSkeleton />
        </div>

        <VestingScheduleSkeleton />
      </>
    );

  return (
    <>
      <div className="flex w-full flex-col gap-6 md:flex-row">
        <VestingOverview />
        <VestingRewards />
      </div>

      <VestingSchedule />
    </>
  );
}
