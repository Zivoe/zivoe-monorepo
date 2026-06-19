export const accountTypeValues = ['individual', 'organization'] as const;
export type AccountType = (typeof accountTypeValues)[number];

export const individualAmountValues = ['1k_10k', '10k_100k', '100k_250k', '250k_1m', 'over_1m'] as const;
export type IndividualAmountOfInterest = (typeof individualAmountValues)[number];

export const orgAmountValues = ['under_10k', '10k_100k', '100k_250k', '250k_1m', '1m_5m', 'over_5m'] as const;
export type OrgAmountOfInterest = (typeof orgAmountValues)[number];

export const amountOfInterestValues = [...individualAmountValues, 'under_10k', '1m_5m', 'over_5m'] as const;
export type AmountOfInterest = (typeof amountOfInterestValues)[number];

export const howFoundZivoeValues = [
  'x_twitter',
  'linkedin',
  'google_search',
  'media_coverage',
  'conference_event',
  'word_of_mouth',
  'other'
] as const;
export type HowFoundZivoe = (typeof howFoundZivoeValues)[number];
