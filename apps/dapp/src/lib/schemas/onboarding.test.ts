import { describe, expect, it } from 'vitest';

import { onboardingSchema } from './onboarding';

const INDIVIDUAL = {
  accountType: 'individual',
  firstName: 'Ada',
  lastName: 'Lovelace',
  countryOfResidence: 'GB',
  amountOfInterest: '10k_100k',
  howFoundZivoe: 'other'
};

const ORGANIZATION = {
  accountType: 'organization',
  firstName: 'Ada',
  lastName: 'Lovelace',
  jobTitle: 'CFO',
  entityName: 'Acme',
  countryOfIncorporation: 'SG',
  amountOfInterest: '1m_5m',
  howFoundZivoe: 'other'
};

// The server action re-parses with this schema, so the dropdown is not the only gate.
describe('onboardingSchema country', () => {
  it('accepts a supported ISO code for either account type', () => {
    expect(onboardingSchema.safeParse(INDIVIDUAL).success).toBe(true);
    expect(onboardingSchema.safeParse(ORGANIZATION).success).toBe(true);
  });

  it.each([
    ['a sanctioned country', 'IR'],
    ['an unknown code', 'XX'],
    ['a country name', 'Romania']
  ])('refuses %s for either account type', (_, country) => {
    expect(onboardingSchema.safeParse({ ...INDIVIDUAL, countryOfResidence: country }).success).toBe(false);
    expect(onboardingSchema.safeParse({ ...ORGANIZATION, countryOfIncorporation: country }).success).toBe(false);
  });
});
