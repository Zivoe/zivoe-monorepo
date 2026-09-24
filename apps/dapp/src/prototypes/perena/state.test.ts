import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { PERENA_DEMO } from './config';
import {
  type DemoState,
  type DemoTab,
  amountError,
  demoReducer,
  formatDemoAmount,
  initialDemoState,
  parseDemoAmount,
  restoreDemoSession,
  serializeDemoSession
} from './state';

function review(state: DemoState, input: string, tab: DemoTab = 'deposit') {
  state = demoReducer(state, { type: 'connect' });
  state = demoReducer(state, { type: 'tab', tab });
  state = demoReducer(state, { type: 'input', value: input });
  return demoReducer(state, { type: 'review', id: randomUUID(), at: '2026-09-23T12:00:00.000Z' });
}

function settle(state: DemoState) {
  state = demoReducer(state, { type: 'confirm' });
  return demoReducer(state, { type: 'complete', id: state.transaction!.id });
}

describe('local demo accounting', () => {
  it('deposits, partially redeems, and fully redeems without losing a micro-unit', () => {
    let state = settle(review(initialDemoState(), '300.123456'));
    expect(state.usdc).toBe(699_876_544n);
    expect(state.shares).toBe(300_123_456n);
    state = settle(review(state, '0.123456', 'redeem'));
    expect(state.usdc).toBe(700_000_000n);
    expect(state.shares).toBe(300_000_000n);
    state = settle(review(state, '300', 'redeem'));
    expect(state.usdc).toBe(PERENA_DEMO.initialUsdc);
    expect(state.shares).toBe(0n);
    expect(state.activity.map((tx) => tx.kind)).toEqual(['redeem', 'redeem', 'deposit']);
  });

  it.each(['', '0', '-1', '0.0000001', '1.2345678', '1000.000001', '1e3', 'Infinity', '1,000', ' 1 ', '9'.repeat(100)])(
    'rejects invalid deposit %j',
    (input) => {
      const state = review(initialDemoState(), input);
      expect(state.stage).toBe('edit');
      expect(state.usdc).toBe(PERENA_DEMO.initialUsdc);
      expect(amountError(input, state.usdc)).toBeTruthy();
    }
  );

  it('requires the demo wallet and limits redemptions to held shares', () => {
    const state = demoReducer(
      { ...initialDemoState(), input: '1' },
      { type: 'review', id: randomUUID(), at: new Date().toISOString() }
    );
    expect(state.stage).toBe('edit');
    expect(review(initialDemoState(), '1', 'redeem').stage).toBe('edit');
  });

  it('can cancel before confirmation without changing balances or activity', () => {
    const reviewed = review(initialDemoState(), '100');
    const cancelled = demoReducer(reviewed, { type: 'cancel' });
    expect(cancelled).toMatchObject({ usdc: PERENA_DEMO.initialUsdc, shares: 0n, activity: [], stage: 'edit' });
    expect(demoReducer(cancelled, { type: 'complete', id: reviewed.transaction!.id })).toBe(cancelled);
  });

  it('prevents duplicate confirmations, completions, edits, and tab changes during processing', () => {
    const processing = demoReducer(review(initialDemoState(), '100'), { type: 'confirm' });
    expect(demoReducer(processing, { type: 'confirm' })).toBe(processing);
    expect(demoReducer(processing, { type: 'input', value: '900' })).toBe(processing);
    expect(demoReducer(processing, { type: 'tab', tab: 'redeem' })).toBe(processing);
    expect(demoReducer(processing, { type: 'cancel' })).toBe(processing);
    expect(demoReducer(processing, { type: 'complete', id: 'wrong-id' })).toBe(processing);
    const completion = { type: 'complete' as const, id: processing.transaction!.id };
    const settled = demoReducer(processing, completion);
    expect(demoReducer(settled, completion)).toBe(settled);
    expect(settled.activity).toHaveLength(1);
  });

  it('parses and formats exact six-decimal balances', () => {
    expect(parseDemoAmount('.000001')).toBe(1n);
    expect(parseDemoAmount('1000.')).toBe(1_000_000_000n);
    expect(formatDemoAmount(1_000_000_001n)).toBe('1,000.000001');
    expect(formatDemoAmount(1_000_000_001n, false)).toBe('1000.000001');
  });
});

describe('session persistence', () => {
  it('restores completed balances and activity, and resets the whole fixture', () => {
    const settled = settle(review(initialDemoState(), '123.456789'));
    const restored = restoreDemoSession(serializeDemoSession(settled));
    expect(restored).toMatchObject({
      usdc: settled.usdc,
      shares: settled.shares,
      connected: true,
      activity: settled.activity,
      stage: 'edit',
      transaction: null
    });
    expect(demoReducer(restored, { type: 'reset' })).toEqual(initialDemoState());
  });

  it.each(['review', 'processing'] as const)('does not commit an interrupted %s', (stage) => {
    let state = review(initialDemoState(), '100');
    if (stage === 'processing') state = demoReducer(state, { type: 'confirm' });
    const restored = restoreDemoSession(serializeDemoSession(state));
    expect(restored).toMatchObject({
      usdc: PERENA_DEMO.initialUsdc,
      shares: 0n,
      activity: [],
      stage: 'edit',
      transaction: null
    });
  });

  it.each([
    null,
    '{broken',
    '{}',
    '{"version":2}',
    '{"version":1,"connected":true,"usdc":"-1","shares":"1000000001","activity":[]}',
    '{"version":1,"connected":true,"usdc":"1000000000","shares":"1","activity":[]}'
  ])('discards corrupted or incompatible session %j', (raw) => {
    expect(restoreDemoSession(raw)).toEqual(initialDemoState());
  });
});
