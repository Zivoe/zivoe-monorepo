import { skipToken, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-keys';
import { handlePromise } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import { useBlockchainTimestamp } from '@/hooks/useBlockchainTimestamp';

import { ApiResponseError, ApiResponseSuccess } from '@/app/api/utils';
import { VestingScheduleData } from '@/app/api/vesting/route';

const DEFAULT_ERROR_MESSAGE = 'Failed to fetch vesting schedule';

export type VestingSchedule = {
  start: bigint;
  cliff: bigint;
  end: bigint;
  totalVesting: bigint;
  totalWithdrawn: bigint;
  vestingPerSecond: bigint;
  revokable: boolean;
  vestedAmount: bigint;
  isDuringCliff: boolean;
};

const calculateVestedAmount = (
  schedule: Omit<VestingSchedule, 'vestedAmount' | 'isDuringCliff'>,
  currentTimestamp: bigint
) => {
  const { start, end, cliff, vestingPerSecond, totalVesting } = schedule;

  if (currentTimestamp < start) return 0n;
  if (currentTimestamp < cliff) return 0n;
  if (currentTimestamp >= end) return totalVesting;

  const elapsed = currentTimestamp - start;
  return vestingPerSecond * elapsed;
};

export const useVestingSchedule = () => {
  const { address } = useAccount();
  const { data: blockchainTimestamp } = useBlockchainTimestamp();
  const skip = !address || !blockchainTimestamp;

  return useQuery({
    queryKey: queryKeys.account.vestingSchedule({ accountAddress: address }),
    queryFn: skip
      ? skipToken
      : async () => {
          const { err, res } = await handlePromise(fetch(`/api/vesting?address=${encodeURIComponent(address)}`));
          if (err || !res) throw new Error(DEFAULT_ERROR_MESSAGE);

          if (!res.ok) {
            const errorData = (await res.json().catch(() => ({ error: DEFAULT_ERROR_MESSAGE }))) as ApiResponseError;
            throw new Error(errorData.error);
          }

          const response = (await res.json()) as ApiResponseSuccess<VestingScheduleData>;
          if (!response.data) return null;

          const schedule = {
            start: BigInt(response.data.start),
            cliff: BigInt(response.data.cliff),
            end: BigInt(response.data.end),
            totalVesting: BigInt(response.data.totalVesting),
            totalWithdrawn: BigInt(response.data.totalWithdrawn),
            vestingPerSecond: BigInt(response.data.vestingPerSecond),
            revokable: response.data.revokable
          };

          const vestedAmount = calculateVestedAmount(schedule, blockchainTimestamp);
          const isDuringCliff = blockchainTimestamp < schedule.cliff;

          const parsedSchedule: VestingSchedule = {
            ...schedule,
            vestedAmount,
            isDuringCliff
          };

          return parsedSchedule;
        }
  });
};
