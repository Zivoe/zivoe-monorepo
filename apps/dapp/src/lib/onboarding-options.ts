import type { AmountOfInterest, AmountOfInterestOption, HowFoundZivoe } from '@zivoe/database/onboarding';

/** What onboarding offers. */
export const AMOUNT_OF_INTEREST_OPTIONS: Record<AmountOfInterestOption, string> = {
  under_10k: '< $10k',
  '10k_100k': '$10k - $100k',
  '100k_250k': '$100k - $250k',
  '250k_1m': '$250k - $1M',
  '1m_5m': '$1M - $5M',
  over_5m: '> $5M'
};

/** How a stored answer reads, those given before the lists merged included. */
export const AMOUNT_OF_INTEREST_LABELS: Record<AmountOfInterest, string> = {
  ...AMOUNT_OF_INTEREST_OPTIONS,
  '1k_10k': '$1k - $10k',
  over_1m: '>$1M'
};

export const HOW_FOUND_ZIVOE_OPTIONS: Record<HowFoundZivoe, string> = {
  x_twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  google_search: 'Google Search',
  media_coverage: 'Media Coverage',
  conference_event: 'Conference / Event',
  word_of_mouth: 'Word of Mouth',
  other: 'Other'
};
