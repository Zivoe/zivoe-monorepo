import { ABI } from '@centrifuge/sdk';
import {
  type Address,
  BaseError,
  type Hex,
  decodeErrorResult,
  hexToBigInt,
  isHex,
  parseAbi
} from 'viem';

import { AppError, handlePromise } from '@/lib/utils';

/** Maps decoded protocol error names to flow-specific product copy. */
export type SimulationErrorCopy = Record<string, string>;

export type WalletClientLike = { request(args: { method: string; params?: unknown }): Promise<unknown> };

export type SimulationClient = {
  call(params: { account?: Address; to?: Address; data?: Hex; value?: bigint }): Promise<unknown>;
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

/**
 * Wraps the wallet's EIP-1193 provider so the SDK's fully formed
 * eth_sendTransaction is `eth_call`ed first with the exact same
 * from/to/data/value; the wallet only ever sees calls that simulate clean.
 */
export function createSimulationSigner({
  walletClient,
  simulationClient,
  errorCopy
}: {
  walletClient: WalletClientLike;
  simulationClient: SimulationClient;
  errorCopy: SimulationErrorCopy;
}): WalletClientLike {
  return {
    request: async (args) => {
      if (args.method === 'eth_sendTransaction') {
        const [transaction] = args.params as [{ from?: Address; to?: Address; data?: Hex; value?: Hex | bigint }];
        await simulateExactCall({ simulationClient, transaction, errorCopy });
      }

      return walletClient.request(args);
    }
  };
}

async function simulateExactCall({
  simulationClient,
  transaction,
  errorCopy
}: {
  simulationClient: SimulationClient;
  transaction: { from?: Address; to?: Address; data?: Hex; value?: Hex | bigint };
  errorCopy: SimulationErrorCopy;
}) {
  const { err } = await handlePromise(
    simulationClient.call({
      account: transaction.from,
      to: transaction.to,
      data: transaction.data,
      value: typeof transaction.value === 'string' ? hexToBigInt(transaction.value) : transaction.value
    })
  );
  if (!err) return;

  const decoded = decodeRevert(err);

  if (decoded?.errorName === 'Error' && decoded.reason)
    throw new AppError({ message: `Simulation error: ${decoded.reason}`, exception: err });

  const message = decoded && errorCopy[decoded.errorName];
  if (message) throw new AppError({ message, exception: err });

  throw new AppError({ message: 'Simulation error', exception: err });
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
