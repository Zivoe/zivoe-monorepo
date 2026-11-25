import { describe, expect, it } from 'vitest';

import { onboardingSchema } from './onboarding';

const ANSWERS = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  countryOfResidence: 'GB',
  amountOfInterest: '10k_100k',
  referralSource: 'other'
};

// The server action re-parses with this schema, so the dropdown is not the only gate.
describe('onboardingSchema country', () => {
  it('accepts a supported ISO code', () => {
    expect(onboardingSchema.safeParse(ANSWERS).success).toBe(true);
  });

  it.each([
    ['a sanctioned country', 'IR'],
    ['an unknown code', 'XX'],
    ['a country name', 'Romania']
  ])('refuses %s', (_, country) => {
    expect(onboardingSchema.safeParse({ ...ANSWERS, countryOfResidence: country }).success).toBe(false);
  });
});

describe('onboardingSchema names', () => {
  it.each(['https://evil.example/claim', 'claim your refund at zivoe-refunds.example', 'jane@evil.example'])(
    'refuses %s, which an invitation email would print',
    (firstName) => {
      expect(onboardingSchema.safeParse({ ...ANSWERS, firstName }).success).toBe(false);
    }
  );

  it('refuses a line break, which would split an email subject or an ops line', () => {
    expect(onboardingSchema.safeParse({ ...ANSWERS, firstName: 'Ada\nStatus: approved' }).success).toBe(false);
  });

  it.each(['J. R.', "O'Neil", 'Mary-Ann', 'Jean Luc', 'Doe Jr.'])('accepts %s', (firstName) => {
    expect(onboardingSchema.safeParse({ ...ANSWERS, firstName }).success).toBe(true);
  });
});
