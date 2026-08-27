'use client';

import * as Sentry from '@sentry/nextjs';
import { toast as sonnerToast } from 'sonner';
import {
  type Abi,
  type Address,
  BaseError,
  type ContractEventName,
  type ContractFunctionArgs,
  type ContractFunctionName,
  ContractFunctionRevertedError,
  type Hash,
  type SimulateContractParameters,
  type TransactionReceipt,
  parseEventLogs
} from 'viem';
import { useConfig, useWriteContract } from 'wagmi';
import { type WriteContractParameters, getPublicClient } from 'wagmi/actions';

import { toast } from '@zivoe/ui/core/sonner';

import { waitForRpcCatchup } from '@/lib/chains';
import { AppError, handlePromise } from '@/lib/utils';

import useTxLifecycle, { type TxContext, type TxSharedConfig } from './useTxLifecycle';

// The transaction choreography lives in useTxLifecycle; re-exported here so
// existing import sites keep working.
export {
  TX_ANALYTICS,
  type TxAnalyticsChoreography,
  type TxAnalyticsFlow,
  type TxAnalyticsInput,
  type TxAnalyticsStep,
  type TxContext,
  type TxSharedConfig
} from './useTxLifecycle';

/** Contract-call params that are both simulatable and writeable, so one build feeds simulate and send. */
export type TxParams<
  TAbi extends Abi = Abi,
  TFunctionName extends ContractFunctionName<TAbi, 'nonpayable' | 'payable'> = ContractFunctionName<
    TAbi,
    'nonpayable' | 'payable'
  >
> = SimulateContractParameters<
  TAbi,
  TFunctionName,
  ContractFunctionArgs<TAbi, 'nonpayable' | 'payable', TFunctionName>,
  undefined,
  undefined,
  Address | undefined
> &
  WriteContractParameters<TAbi, TFunctionName> & {
    /** Required, not optional: every read (simulate, receipt wait) follows this pin, so a driver cannot silently ride the wallet's current chain. */
    chainId: number;
  };

export type TxConfig<TVariables, TParams extends TxParams> = TxSharedConfig<TVariables> & {
  /** Builds (and guards) the contract call; throw AppError for validation failures. May be async (e.g. permit signing). */
  buildParams: (vars: TVariables, ctx: TxContext) => TParams | Promise<TParams>;
};

/**
 * Parses the first matching event log from a receipt, capturing (not throwing)
 * parse failures so the transaction dialog still renders.
 */
export function parseReceiptEvent<TAbi extends Abi, TEventName extends ContractEventName<TAbi>>({
  receipt,
  abi,
  eventName,
  sentryFlow
}: {
  receipt: TransactionReceipt;
  abi: TAbi;
  eventName: TEventName;
  sentryFlow: string;
}) {
  try {
    const logs = parseEventLogs({ abi, eventName, logs: receipt.logs });
    return logs[0];
  } catch (error) {
    Sentry.captureException(error, { tags: { source: 'MUTATION', flow: sentryFlow } });
    return undefined;
  }
}

/**
 * Viem driver for the shared transaction lifecycle in useTxLifecycle:
 * guards -> simulate -> send -> analytics -> pending toast until receipt ->
 * transaction dialog -> query refetches. Everything transaction-specific
 * comes in through the config.
 */
export default function useTx<TVariables, TParams extends TxParams>(config: TxConfig<TVariables, TParams>) {
  const wagmiConfig = useConfig();
  const { mutateAsync: writeContract } = useWriteContract();

  // Reads follow the params' pinned chain (TxParams requires chainId), so a
  // write can never silently simulate against the wallet's current chain.
  const publicClientFor = (params: TParams) => getPublicClient(wagmiConfig, { chainId: params.chainId });

  const simulateTx = async (params: TParams, address: Address | undefined) => {
    const publicClient = publicClientFor(params);
    if (!publicClient) throw new Error('Public client not found');

    const { err } = await handlePromise(publicClient.simulateContract({ ...params, account: address }));
    if (!err) return;

    console.error('Simulation error: ', err);

    if (err instanceof BaseError) {
      const revertError = err.walk((err) => err instanceof ContractFunctionRevertedError);

      if (revertError instanceof ContractFunctionRevertedError) {
        const revertReason = revertError.reason;
        if (revertReason) throw new AppError({ message: `Simulation error: ${revertReason}`, exception: err });
      }
    }

    throw new AppError({ message: 'Simulation error', exception: err });
  };

  const sendTx = async (params: TParams) => {
    const { err, res: hash } = await handlePromise(writeContract(params));

    if (err || !hash) {
      const isUserRejection = err && err instanceof Error && err.message.includes('User rejected the request');
      if (isUserRejection)
        throw new AppError({
          message: 'Transaction rejected',
          exception: err,
          refetch: false,
          type: 'warning',
          capture: false
        });
      else throw err;
    }

    return hash;
  };

  const waitForTxReceipt = async ({
    params,
    hash,
    pendingMessage,
    setIsTxPending
  }: {
    params: TParams;
    hash: Hash;
    pendingMessage: string;
    setIsTxPending: (isPending: boolean) => void;
  }) => {
    const publicClient = publicClientFor(params);
    if (!publicClient) throw new Error('Public client not found');

    setIsTxPending(true);
    const toastId = toast({ type: 'pending', title: pendingMessage });

    const { err, res: receipt } = await handlePromise(publicClient.waitForTransactionReceipt({ hash }));

    // On the Base chains that receipt can be a Flashblock preconfirmation up
    // to ~2s ahead of readable state — stay in the pending phase (toast and
    // button) until the RPC catches up, so the lifecycle's refetches and the
    // dialog read post-transaction balances instead of flashing stale ones.
    // Chains without a catch-up margin resolve immediately.
    if (receipt)
      await waitForRpcCatchup({ client: publicClient, chainId: params.chainId, receiptBlock: receipt.blockNumber });

    setIsTxPending(false);
    if (toastId !== undefined) sonnerToast.dismiss(toastId);

    if (err || !receipt) throw new AppError({ message: 'Error checking transaction receipt', exception: err });

    return receipt;
  };

  return useTxLifecycle({
    ...config,
    prepare: config.buildParams,

    send: async (vars, params, { address, choreography, capture, onTxHash, setIsTxPending }) => {
      await simulateTx(params, address);

      const hash = await sendTx(params);
      onTxHash(hash);
      capture(choreography?.submitted, { txHash: hash });

      return waitForTxReceipt({ params, hash, pendingMessage: config.pendingToast(vars), setIsTxPending });
    }
  });
}
