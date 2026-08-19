import { type erc20Abi } from 'viem';
import { type Address } from 'viem/accounts';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';

import { getChainId } from '@/lib/chains';
import { queryKeys } from '@/lib/query-keys';
import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import useTx, { type TxParams, parseReceiptEvent } from './useTx';

export type ApproveTokenAbi = typeof erc20Abi;
export type ApproveTokenParams = TxParams<ApproveTokenAbi, 'approve'>;

type ApproveSpendingVariables = {
  /** The chain the approval executes on — token and spender addresses are chain-scoped. */
  chain: CentrifugeChain;
  contract: Address;
  spender: Address;
  amount?: bigint;
  name: string;
  /** Snapshotted onto the payload so the receipt dialog renders the approved token exactly. */
  decimals: number;
  abi: ApproveTokenAbi;
  successMessage: string;
  errorMessage: string;
};

/**
 * The approval itself is deliberately cross-Zivoe Vault (one router spender), but
 * the deposit funnel segments per Zivoe Vault — the initiating Zivoe Vault's slug is
 * hook-level identity so analytics AND Sentry captures carry it, same as
 * useCentrifugeTx tags every transaction of the flows behind it.
 */
export const useApproveSpending = ({ zivoeVaultSlug }: { zivoeVaultSlug: string }) => {
  return useTx<ApproveSpendingVariables, ApproveTokenParams>({
    buildParams: ({ chain, contract, spender, amount, abi }) => {
      if (!amount || amount === 0n) throw new AppError({ message: 'No amount to approve' });

      const params: ApproveTokenParams = {
        abi,
        address: contract,
        functionName: 'approve',
        args: [spender, amount],
        // Pins simulation, sending and the receipt wait to the approval's
        // chain; wagmi additionally refuses to send if the wallet sits elsewhere.
        chainId: getChainId(chain)
      };

      return params;
    },

    analytics: {
      flow: 'approval',
      input: ({ chain, name, amount, spender }, { address }) => ({
        walletAddress: address,
        chainId: getChainId(chain),
        zivoeVaultSlug,
        tokenIn: name,
        amountInRaw: amount,
        spender
      })
    },

    pendingToast: ({ name }) => `Approving ${name}...`,
    errorToast: ({ name }) => `Error Approving ${name}`,
    sentryFlow: 'approve',
    // The lifecycle derives the `zivoeVault`/`chain` Sentry tags and the
    // payload stamps from these.
    zivoeVaultSlug,
    chain: (vars) => vars.chain,
    sentryExtras: ({ abi: _abi, ...variables }) => variables,

    transactionData: (receipt, { name, decimals, abi, successMessage, errorMessage }) => {
      let meta: TransactionData['meta'] = undefined;

      if (receipt.status === 'success') {
        const approvalLog = parseReceiptEvent({ receipt, abi, eventName: 'Approval', sentryFlow: 'approve' });
        const amount = approvalLog?.args.value;

        if (amount) {
          meta = {
            approve: {
              token: { symbol: name, decimals },
              amount
            }
          };
        }
      }

      return receipt.status === 'success'
        ? {
            type: 'SUCCESS',
            title: 'Approval Successful',
            description: successMessage,
            hash: receipt.transactionHash,
            meta
          }
        : {
            type: 'ERROR',
            title: 'Approval Failed',
            description: errorMessage,
            hash: receipt.transactionHash
          };
    },

    invalidate: ({ queryClient, address, vars }) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.account.allowance({
          accountAddress: address,
          chain: vars.chain,
          contract: vars.contract,
          spender: vars.spender
        })
      });
    }
  });
};
