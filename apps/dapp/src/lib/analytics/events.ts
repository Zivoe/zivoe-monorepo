import { NETWORK_CHAIN } from '@/lib/network';
import { AppError } from '@/lib/utils';

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
  | 'tx:redeem_claim_started'
  | 'tx:redeem_claim_signature_rejected'
  | 'tx:redeem_claim_submitted'
  | 'tx:redeem_claim_receipt'
  | 'tx:redeem_claim_failed'
  | 'tx:redeem_cancel_started'
  | 'tx:redeem_cancel_signature_rejected'
  | 'tx:redeem_cancel_submitted'
  | 'tx:redeem_cancel_receipt'
  | 'tx:redeem_cancel_failed'
  | 'tx:redeem_claim_returned_started'
  | 'tx:redeem_claim_returned_signature_rejected'
  | 'tx:redeem_claim_returned_submitted'
  | 'tx:redeem_claim_returned_receipt'
  | 'tx:redeem_claim_returned_failed'
  | 'tx:approval_started'
  | 'tx:approval_signature_rejected'
  | 'tx:approval_submitted'
  | 'tx:approval_confirmed'
  | 'tx:approval_failed';

type AnalyticsPropertyValue = string | number | boolean | null | undefined | Array<string | number | boolean>;

export type AnalyticsProperties = Record<string, AnalyticsPropertyValue | Record<string, unknown>>;

export type TransactionFlow =
  | 'deposit'
  | 'redeem'
  | 'redeem_claim'
  | 'redeem_cancel'
  | 'redeem_claim_returned'
  | 'approval';

export type TransactionAnalyticsInput = {
  flow: TransactionFlow;
  step: string;
  walletAddress?: string | null;
  chainId?: number;
  /** Stable product identity of the Offering transacted on. */
  offeringSlug?: string | null;
  // Symbols travel as plain strings: they come from the transacted identity
  // object, and test fixtures are deliberately unregistered.
  tokenIn?: string | null;
  tokenOut?: string | null;
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
    // Default to the deployment's configured chain — a hardcoded mainnet
    // fallback mislabelled every event whose caller omitted chainId.
    chain_id: input.chainId ?? NETWORK_CHAIN.id,
    offering_slug: input.offeringSlug ?? undefined,
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
  // Decoded simulation blocks carry friendly copy without the marker, so the
  // flag is the signal. The message check below only covers useTx's simulation
  // path, which still prefixes and sets no flag.
  if (error instanceof AppError && error.simulation) return 'simulation_failed';
  if (error instanceof Error && error.message.includes('Simulation error')) return 'simulation_failed';
  return 'failed';
}
