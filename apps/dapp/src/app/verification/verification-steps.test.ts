import { describe, expect, it } from 'vitest';

import { currentStepFor, stepCountOf } from './verification-steps';

const base = { requested: undefined, canStart: true, hasCountry: true, hasAccepted: false, isYesDecision: false };

describe('currentStepFor', () => {
  it('opens a subject that can still start on its details, and moves it on to the Persona flow when asked', () => {
    expect(currentStepFor(base)).toBe('profile');
    expect(currentStepFor({ ...base, requested: 'identity' })).toBe('identity');
    expect(currentStepFor({ ...base, requested: 'identity', hasAccepted: true })).toBe('identity');
  });

  it('keeps a subject without a real country on its details while it can start', () => {
    expect(currentStepFor({ ...base, requested: 'identity', hasCountry: false })).toBe('profile');
    // Once started, the country is Persona's: nothing to hold back.
    expect(currentStepFor({ ...base, canStart: false, hasCountry: false })).toBe('identity');
  });

  it('keeps a subject past the start on the Persona flow until a yes Decision, its details still readable', () => {
    const started = { ...base, canStart: false };
    expect(currentStepFor(started)).toBe('identity');
    expect(currentStepFor({ ...started, hasAccepted: true })).toBe('identity');
    expect(currentStepFor({ ...started, requested: 'details' })).toBe('profile');
  });

  it('asks for the agreements after a yes Decision, then ends on Wallets, whatever the URL asks', () => {
    const decided = { ...base, canStart: false, isYesDecision: true };
    for (const requested of [undefined, 'details', 'identity', 'agreements']) {
      expect(currentStepFor({ ...decided, requested })).toBe('agreements');
      expect(currentStepFor({ ...decided, requested, hasAccepted: true })).toBe('wallets');
    }
  });
});

describe('stepCountOf', () => {
  it('counts four steps', () => {
    expect(['profile', 'identity', 'agreements', 'wallets'].map((id) => stepCountOf(id as never))).toEqual([
      'Step 1 of 4',
      'Step 2 of 4',
      'Step 3 of 4',
      'Step 4 of 4'
    ]);
  });
});
