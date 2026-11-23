/** The list onboarding asks from: one list for everyone, as amount of interest belongs to the person. */
export const amountOfInterestOptionValues = [
  'under_10k',
  '10k_100k',
  '100k_250k',
  '250k_1m',
  '1m_5m',
  'over_5m'
] as const;
export type AmountOfInterestOption = (typeof amountOfInterestOptionValues)[number];

/** Everything the column can hold: the list above, plus the answers given before the two lists merged. */
export const amountOfInterestValues = [
  '1k_10k',
  '10k_100k',
  '100k_250k',
  '250k_1m',
  'over_1m',
  'under_10k',
  '1m_5m',
  'over_5m'
] as const;
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
