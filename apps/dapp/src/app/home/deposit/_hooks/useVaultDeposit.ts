import { useMutation } from '@tanstack/react-query';
import { SimulateContractParameters } from 'viem';
import { useAccount } from 'wagmi';
import { WriteContractParameters } from 'wagmi/actions';

import { zivoeVaultAbi } from '@zivoe/contracts/abis';

import { DepositToken } from '@/types/constants';

import { CONTRACTS } from '@/lib/constants';
import { AppError, onTxError } from '@/lib/utils';

import useTx from '@/hooks/useTx';

export type VaultDepositToken = Extract<DepositToken, 'zSTT'>;
export type VaultDepositParams = WriteContractParameters<typeof zivoeVaultAbi, 'deposit'>;

export const useVaultDeposit = () => {
  const { address } = useAccount();
  const { simulateTx, sendTx, waitForTxReceipt, isTxPending } = useTx();

  const mutationInfo = useMutation({
    mutationFn: async ({ stableCoinName, amount }: { stableCoinName: VaultDepositToken; amount?: bigint }) => {
      if (!address) throw new AppError({ message: 'Wallet not connected' });
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to deposit' });

      const params: VaultDepositParams & SimulateContractParameters = {
        abi: zivoeVaultAbi,
        address: CONTRACTS.zVLT,
        functionName: 'deposit',
        args: [amount, address]
      };

      await simulateTx(params);

      const { hash } = await sendTx(params);

      const receipt = await waitForTxReceipt({
        hash,
        messages: { pending: `Depositing ${stableCoinName}...` }
      });

      return { receipt };
    },

    onError: (err, { stableCoinName }) =>
      onTxError({
        err,
        defaultToastMsg: `Error Depositing ${stableCoinName}`
      })

    // TODO: add onSuccess, onSettled
  });

  return {
    isTxPending,
    ...mutationInfo
  };
};
