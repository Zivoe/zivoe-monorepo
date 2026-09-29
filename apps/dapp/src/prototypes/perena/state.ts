import { z } from 'zod';

import { PERENA_DEMO } from './config';

export type DemoTab = 'deposit' | 'redeem';
export type DemoTransaction = { id: string; kind: DemoTab; amount: bigint; at: string };
export type DemoState = {
  connected: boolean;
  usdc: bigint;
  shares: bigint;
  tab: DemoTab;
  input: string;
  stage: 'edit' | 'review' | 'processing' | 'success';
  transaction: DemoTransaction | null;
  activity: Array<DemoTransaction>;
};

export type DemoAction =
  | { type: 'restore'; state: DemoState }
  | { type: 'connect' }
  | { type: 'tab'; tab: DemoTab }
  | { type: 'input'; value: string }
  | { type: 'review'; id: string; at: string }
  | { type: 'confirm' }
  | { type: 'complete'; id: string }
  | { type: 'cancel' }
  | { type: 'done' }
  | { type: 'reset' };

export function initialDemoState(tab: DemoTab = 'deposit'): DemoState {
  return {
    connected: false,
    usdc: PERENA_DEMO.initialUsdc,
    shares: 0n,
    tab,
    input: '',
    stage: 'edit',
    transaction: null,
    activity: []
  };
}

const SCALE = 10n ** BigInt(PERENA_DEMO.decimals);

export function parseDemoAmount(input: string): bigint | null {
  // Bound the input before BigInt conversion. No floats, exponents, signs or rounding.
  if (input.length > 30 || !/^(?:\d+(?:\.\d{0,6})?|\.\d{1,6})$/.test(input)) return null;
  const [whole = '', fraction = ''] = input.split('.');
  return BigInt(whole || '0') * SCALE + BigInt(fraction.padEnd(PERENA_DEMO.decimals, '0'));
}

export function formatDemoAmount(amount: bigint, grouped = true): string {
  const whole = (amount / SCALE).toString();
  const fraction = (amount % SCALE).toString().padStart(PERENA_DEMO.decimals, '0').replace(/0+$/, '');
  const integer = grouped ? whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : whole;
  return fraction ? `${integer}.${fraction}` : integer;
}

export function amountError(input: string, balance: bigint): string | null {
  if (!input) return 'Enter an amount.';
  const amount = parseDemoAmount(input);
  if (amount === null) return 'Enter a positive amount with up to 6 decimal places.';
  if (amount <= 0n) return 'Enter an amount greater than zero.';
  if (amount > balance) return 'This amount exceeds your demo balance.';
  return null;
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'restore':
      return { ...action.state, tab: state.tab };
    case 'reset':
      return initialDemoState(state.tab);
    case 'connect':
      return { ...state, connected: true };
    case 'tab':
      if (state.stage === 'processing') return state;
      return { ...state, tab: action.tab, input: '', stage: 'edit', transaction: null };
    case 'input':
      return state.stage === 'edit' ? { ...state, input: action.value } : state;
    case 'review': {
      const balance = state.tab === 'deposit' ? state.usdc : state.shares;
      if (!state.connected || state.stage !== 'edit' || amountError(state.input, balance)) return state;
      const amount = parseDemoAmount(state.input)!;
      return {
        ...state,
        stage: 'review',
        transaction: { id: action.id, kind: state.tab, amount, at: action.at }
      };
    }
    case 'confirm':
      return state.stage === 'review' && state.transaction ? { ...state, stage: 'processing' } : state;
    case 'complete': {
      const tx = state.transaction;
      if (state.stage !== 'processing' || tx?.id !== action.id) return state;
      const delta = tx.kind === 'deposit' ? tx.amount : -tx.amount;
      return {
        ...state,
        stage: 'success',
        usdc: state.usdc - delta,
        shares: state.shares + delta,
        activity: [tx, ...state.activity].slice(0, 50)
      };
    }
    case 'cancel':
      return state.stage === 'review' ? { ...state, stage: 'edit', transaction: null } : state;
    case 'done':
      return state.stage === 'success' ? { ...state, stage: 'edit', input: '', transaction: null } : state;
  }
}

const unitsSchema = z
  .string()
  .regex(/^\d{1,10}$/)
  .transform(BigInt);
const sessionSchema = z
  .object({
    version: z.literal(1),
    connected: z.boolean(),
    usdc: unitsSchema,
    shares: unitsSchema,
    activity: z
      .array(
        z.object({
          id: z.string().uuid(),
          kind: z.enum(['deposit', 'redeem']),
          amount: unitsSchema.refine((value) => value > 0n && value <= PERENA_DEMO.initialUsdc),
          at: z.string().datetime()
        })
      )
      .max(50)
  })
  .refine((value) => value.usdc + value.shares === PERENA_DEMO.initialUsdc);

export function serializeDemoSession(state: DemoState): string {
  // Only settled balances persist. Reloading never commits an interrupted transaction.
  return JSON.stringify(
    {
      version: 1,
      connected: state.connected,
      usdc: state.usdc,
      shares: state.shares,
      activity: state.activity
    },
    (_, value: unknown) => (typeof value === 'bigint' ? value.toString() : value)
  );
}

export function restoreDemoSession(raw: string | null): DemoState {
  try {
    const parsed = sessionSchema.safeParse(JSON.parse(raw ?? 'null'));
    if (!parsed.success) return initialDemoState();
    const { connected, usdc, shares, activity } = parsed.data;
    return { ...initialDemoState(), connected, usdc, shares, activity };
  } catch {
    return initialDemoState();
  }
}
