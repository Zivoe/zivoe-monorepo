import { ABI } from '@centrifuge/sdk';
import * as Sentry from '@sentry/nextjs';
import {
  type Address,
  BaseError,
  type Hex,
  decodeErrorResult,
  hexToBigInt,
  isAddressEqual,
  isHex,
  parseAbi
} from 'viem';

import {
  type NativeCurrency,
  insufficientNativeFundsError,
  isInsufficientNativeFundsError
} from '@/lib/native-funds';
import { AppError, handlePromise } from '@/lib/utils';

/** Maps decoded protocol error names to flow-specific product copy. */
export type SimulationErrorCopy = Record<string, string>;

export type ExpectedContractCall = {
  to: Address;
  data: Hex;
  mismatchMessage: string;
};

export type WalletClientLike = { request(args: { method: string; params?: unknown }): Promise<unknown> };

export type SimulationClient = {
  call(params: { account?: Address; to?: Address; data?: Hex; value?: bigint }): Promise<unknown>;
  getBalance(params: { address: Address }): Promise<bigint>;
};

// The SDK passes only the router ABI to its writes, so downstream errors need a
// composed, integration-owned error ABI: the relevant SDK fragments plus the
// protocol/token error fragments missing from the generated ones.
const EXTRA_ERROR_FRAGMENTS = parseAbi([
  'error RestrictionsFailed()',
  'error TransferBlocked()',
  'error InsufficientReserve()',
  'error InsufficientBalance(address token, uint256 tokenId, uint256 value, uint256 balance)',
  'error InsufficientBalance()',
  'error InsufficientAllowance()',
  'error Paused()',
  'error NotEnoughGas()'
]);

const ERROR_ABI = [
  ...ABI.VaultRouter,
  ...ABI.AsyncVault,
  ...ABI.AsyncRequests,
  ...ABI.SyncManager,
  ...ABI.Spoke,
  ...ABI.PoolEscrow,
  ...EXTRA_ERROR_FRAGMENTS
];

// Methods that would move funds or sign something without passing the
// simulate-before-sign gate. None are expected while permits are disabled and
// viem sends via eth_sendTransaction — if one ever crosses the wrapper (a
// wallet or SDK change), the gate has silently lost coverage: flag it, pass it
// through, and let Sentry say so.
const UNSIMULATED_WRITE_METHODS = new Set([
  'eth_sign',
  'eth_signTransaction',
  'eth_signTypedData',
  'eth_signTypedData_v3',
  'eth_signTypedData_v4',
  'eth_sendRawTransaction',
  'personal_sign',
  'wallet_sendCalls'
]);

/**
 * Wraps the wallet's EIP-1193 provider so the SDK's fully formed
 * eth_sendTransaction is `eth_call`ed first with the exact same
 * from/to/data/value; the wallet only ever sees calls that simulate clean.
 */
export function createSimulationSigner({
  walletClient,
  simulationClient,
  errorCopy,
  nativeCurrency,
  expectedCall
}: {
  walletClient: WalletClientLike;
  simulationClient: SimulationClient;
  errorCopy: SimulationErrorCopy;
  nativeCurrency: NativeCurrency;
  expectedCall?: ExpectedContractCall;
}): WalletClientLike {
  return {
    request: async (args) => {
      if (args.method === 'eth_sendTransaction') {
        const [transaction] = args.params as [{ from?: Address; to?: Address; data?: Hex; value?: Hex | bigint }];
        assertExpectedCall({ transaction, expectedCall });
        await simulateExactCall({ simulationClient, transaction, errorCopy, nativeCurrency });
      } else if (UNSIMULATED_WRITE_METHODS.has(args.method)) {
        Sentry.captureMessage('Centrifuge signer passed a write method through without simulation', {
          level: 'warning',
          tags: { source: 'MUTATION' },
          extra: { method: args.method }
        });
      }

      return walletClient.request(args);
    }
  };
}

function assertExpectedCall({
  transaction,
  expectedCall
}: {
  transaction: { to?: Address; data?: Hex };
  expectedCall?: ExpectedContractCall;
}) {
  if (!expectedCall) return;

  const matchesAddress = transaction.to && isAddressEqual(transaction.to, expectedCall.to);
  const matchesData = transaction.data?.toLowerCase() === expectedCall.data.toLowerCase();
  if (matchesAddress && matchesData) return;

  throw new AppError({
    message: expectedCall.mismatchMessage,
    simulation: true,
    capture: false
  });
}

async function simulateExactCall({
  simulationClient,
  transaction,
  errorCopy,
  nativeCurrency
}: {
  simulationClient: SimulationClient;
  transaction: { from?: Address; to?: Address; data?: Hex; value?: Hex | bigint };
  errorCopy: SimulationErrorCopy;
  nativeCurrency: NativeCurrency;
}) {
  const value = typeof transaction.value === 'string' ? hexToBigInt(transaction.value) : (transaction.value ?? 0n);

  const { err } = await handlePromise(
    simulationClient.call({
      account: transaction.from,
      to: transaction.to,
      data: transaction.data,
      value
    })
  );
  if (!err) return;

  const decoded = decodeRevert(err);

  if (decoded?.errorName === 'Error' && decoded.reason)
    throw new AppError({ message: `Simulation error: ${decoded.reason}`, exception: err, simulation: true });

  const message = decoded && errorCopy[decoded.errorName];
  if (message) throw new AppError({ message, exception: err, simulation: true });

  // A value-carrying call (the SDK attaches the cross-chain fee as msg.value)
  // from a wallet holding less than that value is rejected by the node with no
  // revert data. The balance read runs only on this failure path, and only a
  // confirmed shortfall gets the funding copy — an unconfirmed match (balance
  // moved, or an inner call ran out of funds) falls through to the generic
  // fallback rather than telling the user to top up for nothing.
  if (value > 0n && transaction.from && isInsufficientNativeFundsError(err)) {
    const { res: balance } = await handlePromise(simulationClient.getBalance({ address: transaction.from }));
    if (balance !== undefined && balance < value)
      throw insufficientNativeFundsError({ nativeCurrency, requiredValue: value, exception: err, simulation: true });
  }

  throw new AppError({ message: 'Simulation error', exception: err, simulation: true });
}

function decodeRevert(error: unknown): { errorName: string; reason?: string } | undefined {
  const data = extractRevertData(error);
  if (!data) return undefined;

  return decodeRevertData(data, 0);
}

function decodeRevertData(data: Hex, depth: number): { errorName: string; reason?: string } | undefined {
  if (depth > 4) return undefined;

  try {
    const decoded = decodeErrorResult({ abi: ERROR_ABI, data });
    const errorName: string = decoded.errorName;
    const args: ReadonlyArray<unknown> | undefined = decoded.args;

    // Centrifuge's transfer library nests the original revert in WrappedError's
    // `reason` bytes — decode recursively and map the innermost known error.
    if (errorName === 'WrappedError') {
      const reason = args?.[2];
      if (typeof reason === 'string' && isHex(reason) && reason !== '0x') {
        const nested = decodeRevertData(reason, depth + 1);
        if (nested) return nested;
      }
    }

    // viem decodes the solidity built-in Error(string) even without a fragment.
    if (errorName === 'Error') {
      const reason = args?.[0];
      return { errorName, reason: typeof reason === 'string' ? reason : undefined };
    }

    return { errorName };
  } catch {
    return undefined;
  }
}

function extractRevertData(error: unknown): Hex | undefined {
  if (!(error instanceof BaseError)) return undefined;

  let found: Hex | undefined;

  error.walk((cause) => {
    const data = (cause as { data?: unknown }).data;

    if (typeof data === 'string' && isHex(data) && data.length > 2) {
      found = data;
      return true;
    }

    if (
      data &&
      typeof data === 'object' &&
      'data' in data &&
      typeof data.data === 'string' &&
      isHex(data.data) &&
      data.data.length > 2
    ) {
      found = data.data;
      return true;
    }

    return false;
  });

  return found;
}
