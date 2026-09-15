import { type Address } from 'viem/accounts';

import { type CentrifugeChain, type DepositAsset } from '@zivoe/centrifuge-indexer';

import { getChainId } from '@/lib/chains';
import { queryKeys } from '@/lib/query-keys';
import { type TransactionData } from '@/lib/store';
import { AppError } from '@/lib/utils';

import useTx, { type TxParams, parseReceiptEvent } from './useTx';

/**
 * `approve` declared WITHOUT its boolean output, on purpose. The flow never
 * read the boolean (only whether the simulation reverted), and declaring it
 * makes viem decode the return data — which Ethereum-mainnet USDT does not
 * return at all, so its approvals failed before the wallet ever saw them.
 * With no outputs viem skips the decode for every token, standard or not.
 * The `Approval` event is the standard one on all of them.
 */
export const APPROVE_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: []
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  }
] as const;

export type ApproveTokenParams = TxParams<typeof APPROVE_ABI, 'approve'>;

type ApproveSpendingVariables = {
  /** The chain the approval executes on — token and spender addresses are chain-scoped. */
  chain: CentrifugeChain;
  contract: Address;
  spender: Address;
  amount?: bigint;
  name: string;
  /** Snapshotted onto the payload so the receipt dialog renders the approved token exactly. */
  decimals: number;
  /** The token's approval mode from the catalog; `legacy` tokens reset a non-zero allowance first. */
  approval?: DepositAsset['approval'];
  /** The wallet's current allowance for the spender, as the flow last read it — decides whether a reset is due. */
  allowance?: bigint;
  successMessage: string;
  errorMessage: string;
};

/**
 * Whether a legacy token needs its allowance zeroed before `approve(amount)`
 * — such tokens revert on any non-zero → non-zero change. A standard token
 * never does, whatever the allowance.
 */
export function needsAllowanceReset({ approval, allowance }: Pick<ApproveSpendingVariables, 'approval' | 'allowance'>) {
  return approval === 'legacy' && allowance !== undefined && allowance > 0n;
}

/**
 * The approval itself is deliberately cross-Zivoe Vault (one router spender), but
 * the deposit funnel segments per Zivoe Vault — the initiating Zivoe Vault's slug is
 * hook-level identity so analytics AND Sentry captures carry it, same as
 * useCentrifugeTx tags every transaction of the flows behind it.
 */
export const useApproveSpending = ({ zivoeVaultSlug }: { zivoeVaultSlug: string }) => {
  const approveParams = ({
    chain,
    contract,
    spender,
    amount
  }: Pick<ApproveSpendingVariables, 'chain' | 'contract' | 'spender'> & { amount: bigint }): ApproveTokenParams => ({
    abi: APPROVE_ABI,
    address: contract,
    functionName: 'approve',
    args: [spender, amount],
    // Pins simulation, sending and the receipt wait to the approval's
    // chain; wagmi additionally refuses to send if the wallet sits elsewhere.
    chainId: getChainId(chain)
  });

  return useTx<ApproveSpendingVariables, ApproveTokenParams>({
    buildParams: (vars) => {
      if (!vars.amount || vars.amount === 0n) throw new AppError({ message: 'No amount to approve' });
      return approveParams({ ...vars, amount: vars.amount });
    },

    reset: {
      buildParams: (vars) => (needsAllowanceReset(vars) ? approveParams({ ...vars, amount: 0n }) : undefined),
      pendingToast: ({ name }) => `Resetting ${name} approval...`
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

    transactionData: (receipt, { name, decimals, successMessage, errorMessage }) => {
      let meta: TransactionData['meta'] = undefined;

      if (receipt.status === 'success') {
        const approvalLog = parseReceiptEvent({
          receipt,
          abi: APPROVE_ABI,
          eventName: 'Approval',
          sentryFlow: 'approve'
        });
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
