import * as Sentry from '@sentry/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSetAtom } from 'jotai';
import { type SimulateContractParameters, parseEventLogs } from 'viem';
import { type WriteContractParameters } from 'wagmi/actions';

import { CONTRACTS } from '@zivoe/contracts';
import { zivoeRewardsVestingAbi } from '@zivoe/contracts/abis';

import { queryKeys } from '@/lib/query-keys';
import { TransactionData, transactionAtom } from '@/lib/store';
import { onTxError, skipTxSettled } from '@/lib/utils';

import { useAccount } from '@/hooks/useAccount';
import useTx from '@/hooks/useTx';

export type ClaimVestingParams = WriteContractParameters<typeof zivoeRewardsVestingAbi, 'getRewards'>;

export const useClaimVesting = () => {
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();
  const setTransaction = useSetAtom(transactionAtom);

  const mutationInfo = useMutation({
    mutationFn: async () => {
      const params: ClaimVestingParams & SimulateContractParameters = {
        abi: zivoeRewardsVestingAbi,
        address: CONTRACTS.vestZVE,
        functionName: 'fullWithdraw',
        args: []
      };

      await simulateTx(params);

      const { hash } = await sendTx(params);

      const receipt = await waitForTxReceipt({
        hash,
        messages: { pending: 'Claiming...' },
        delay: 2000
      });

      return { receipt };
    },

    onError: (err) => {
      onTxError({
        err,
        defaultToastMsg: 'Error claiming',
        sentry: { flow: 'claim-vesting', extras: {} }
      });
    },

    onSuccess: ({ receipt }) => {
      let amount: bigint | undefined;

      try {
        const withdrawnLogs = parseEventLogs({
          abi: zivoeRewardsVestingAbi,
          eventName: 'Withdrawn',
          logs: receipt.logs
        });

        const withdrawnLog = withdrawnLogs[0];
        if (withdrawnLog) amount = withdrawnLog.args.amount;
      } catch (error) {
        Sentry.captureException(error, { tags: { source: 'MUTATION', flow: 'claim-vesting' } });
      }

      let meta: TransactionData['meta'] = undefined;
      if (amount) {
        meta = {
          claim: { amount }
        };
      }

      const transactionData: TransactionData =
        receipt.status === 'success'
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

      setTransaction(transactionData);
    },

    onSettled: (_, err) => {
      if (skipTxSettled(err)) return;

      // Refetch vesting schedule
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.vestingSchedule({ accountAddress: address })
      });

      // Refetch claimable amount
      queryClient.invalidateQueries({
        queryKey: queryKeys.account.claimableVesting({ accountAddress: address })
      });

      // Refetch blockchain timestamp
      queryClient.invalidateQueries({
        queryKey: queryKeys.app.blockchainTimestamp
      });
    }
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
