import { type SimulateContractParameters } from 'viem';
import { type WriteContractParameters } from 'wagmi/actions';

import { CONTRACTS } from '@zivoe/contracts';
import { zivoeRewardsVestingAbi } from '@zivoe/contracts/abis';

import { queryKeys } from '@/lib/query-keys';
import { type TransactionData } from '@/lib/store';

import useTx, { parseReceiptEvent } from '@/hooks/useTx';

export type ClaimVestingParams = WriteContractParameters<typeof zivoeRewardsVestingAbi, 'fullWithdraw'>;

export const useClaimVesting = () => {
  return useTx({
    buildParams: () => {
      const params: ClaimVestingParams & SimulateContractParameters = {
        abi: zivoeRewardsVestingAbi,
        address: CONTRACTS.vestZVE,
        functionName: 'fullWithdraw',
        args: []
      };

      return params;
    },

    pendingToast: () => 'Claiming...',
    receiptDelay: 2000,
    errorToast: () => 'Error claiming',
    sentryFlow: 'claim-vesting',

    transactionData: (receipt) => {
      const withdrawnLog = parseReceiptEvent({
        receipt,
        abi: zivoeRewardsVestingAbi,
        eventName: 'Withdrawn',
        sentryFlow: 'claim-vesting'
      });

      const amount = withdrawnLog?.args.amount;

      let meta: TransactionData['meta'] = undefined;
      if (amount) {
        meta = {
          claim: { amount }
        };
      }

      return receipt.status === 'success'
        ? {
            type: 'SUCCESS',
            title: 'Claim Successful',
            description: 'You have claimed all vested tokens',
            hash: receipt.transactionHash,
            meta
          }
        : {
            type: 'ERROR',
            title: 'Claim Failed',
            description: 'There was an error claiming your vested ZVE',
            hash: receipt.transactionHash
          };
    },

    invalidate: ({ queryClient, address }) => {
      // Refetch vesting schedule
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.vestingSchedule({ accountAddress: address })
      });

      // Refetch claimable amount
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.claimableVesting({ accountAddress: address })
      });

      // Refetch blockchain timestamp
      void queryClient.invalidateQueries({
        queryKey: queryKeys.app.blockchainTimestamp
      });
    }
  });
};
