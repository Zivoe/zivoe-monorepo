import { describe, expect, it } from 'vitest';

import { currentStepFor, stepCountOf } from './verification-steps';

const base = { requested: undefined, canStart: true, hasCountry: true, hasAccepted: false, isYesDecision: false };

describe('currentStepFor', () => {
  it('opens a subject that can still start on its details, whatever it accepted', () => {
    expect(currentStepFor(base)).toBe('profile');
    expect(currentStepFor({ ...base, hasAccepted: true })).toBe('profile');
  });

  it('keeps a subject without a real country on its details while it can start', () => {
    expect(currentStepFor({ ...base, requested: 'identity', hasCountry: false, hasAccepted: true })).toBe('profile');
    // Once started, the country is Persona's: nothing to hold back.
    expect(currentStepFor({ ...base, canStart: false, hasCountry: false, hasAccepted: true })).toBe('identity');
  });

  it('puts the agreements before the Persona flow until they are accepted', () => {
    expect(currentStepFor({ ...base, requested: 'identity' })).toBe('agreements');
    expect(currentStepFor({ ...base, requested: 'identity', hasAccepted: true })).toBe('identity');
    expect(currentStepFor({ ...base, requested: 'agreements', hasAccepted: true })).toBe('agreements');
  });

  it('asks a subject past the start that never accepted for the agreements, even before Wallets', () => {
    expect(currentStepFor({ ...base, canStart: false })).toBe('agreements');
    expect(currentStepFor({ ...base, canStart: false, isYesDecision: true })).toBe('agreements');
  });

  it('ends a yes Decision on Wallets, and still shows an earlier step asked for', () => {
    const decided = { ...base, canStart: false, hasAccepted: true, isYesDecision: true };
    expect(currentStepFor(decided)).toBe('wallets');
    expect(currentStepFor({ ...decided, requested: 'identity' })).toBe('wallets');
    expect(currentStepFor({ ...decided, requested: 'details' })).toBe('profile');
    expect(currentStepFor({ ...decided, requested: 'agreements' })).toBe('agreements');
  });
});

describe('stepCountOf', () => {
  it('counts four steps', () => {
    expect(['profile', 'agreements', 'identity', 'wallets'].map((id) => stepCountOf(id as never))).toEqual([
      'Step 1 of 4',
      'Step 2 of 4',
      'Step 3 of 4',
      'Step 4 of 4'
    ]);
  });
});
