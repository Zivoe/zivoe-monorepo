import { mainnet } from 'viem/chains';

import { AppError } from '@/lib/utils';
import { type Token } from '@/types/constants';

export type AnalyticsEvent =
  | 'auth:sign-up'
  | 'auth:otp_requested'
  | 'auth:otp_resent'
  | 'onboarding:completed'
  | 'onboarding:started'
  | 'wallet_connected'
  | 'tx:deposit_started'
  | 'tx:deposit_signature_rejected'
  | 'tx:deposit_submitted'
  | 'tx:deposit_receipt'
  | 'tx:deposit_failed'
  | 'tx:deposit_confirmed'
  | 'tx:redeem_started'
  | 'tx:redeem_signature_rejected'
  | 'tx:redeem_submitted'
  | 'tx:redeem_receipt'
  | 'tx:redeem_failed'
  | 'tx:redeem_confirmed'
  | 'tx:approval_started'
  | 'tx:approval_signature_rejected'
  | 'tx:approval_submitted'
  | 'tx:approval_confirmed'
  | 'tx:approval_failed'
  | 'tx:permit_started'
  | 'tx:permit_signature_rejected'
  | 'tx:permit_signed'
  | 'tx:permit_failed';

type AnalyticsPropertyValue = string | number | boolean | null | undefined | Array<string | number | boolean>;

export type AnalyticsProperties = Record<string, AnalyticsPropertyValue | Record<string, unknown>>;

export type TransactionFlow = 'deposit' | 'redeem' | 'approval' | 'permit';

export type TransactionAnalyticsInput = {
  flow: TransactionFlow;
  step: string;
  walletAddress?: string | null;
  chainId?: number;
  tokenIn?: Token | null;
  tokenOut?: Token | null;
  amountInRaw?: bigint | string | number | null;
  amountOutRaw?: bigint | string | number | null;
  spender?: string | null;
  txHash?: string | null;
  blockNumber?: bigint | string | number | null;
  logIndex?: number | null;
  eventId?: string | null;
  receiptStatus?: string | null;
  error_type?: string | null;
};

function toAnalyticsAmount(value: bigint | string | number | null | undefined) {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

export function compactAnalyticsProperties(properties: AnalyticsProperties): AnalyticsProperties {
  return Object.fromEntries(Object.entries(properties).filter(([, value]) => value !== undefined));
}

export function createTransactionProperties(input: TransactionAnalyticsInput): AnalyticsProperties {
  return {
    flow: input.flow,
    step: input.step,
    wallet_address: input.walletAddress?.toLowerCase(),
    chain_id: input.chainId ?? mainnet.id,
    token_in: input.tokenIn ?? undefined,
    token_out: input.tokenOut ?? undefined,
    amount_in_raw: toAnalyticsAmount(input.amountInRaw),
    amount_out_raw: toAnalyticsAmount(input.amountOutRaw),
    spender: input.spender?.toLowerCase(),
    tx_hash: input.txHash?.toLowerCase(),
    block_number: toAnalyticsAmount(input.blockNumber),
    log_index: input.logIndex ?? undefined,
    event_id: input.eventId ?? undefined,
    receipt_status: input.receiptStatus ?? undefined,
    error_type: input.error_type ?? undefined
  };
}

export function getAnalyticsErrorType(error: unknown) {
  if (error instanceof Error && error.message.includes('Transaction rejected')) return 'user_rejected';
  if (error instanceof Error && error.message.includes('User rejected the request')) return 'user_rejected';
  // Decoded simulation blocks carry friendly copy without the marker — the
  // flag, not the message, is the signal (the legacy engine still prefixes it).
  if (error instanceof AppError && error.simulation) return 'simulation_failed';
  if (error instanceof Error && error.message.includes('Simulation error')) return 'simulation_failed';
  return 'failed';
}
