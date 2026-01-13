import type { HowFoundZivoe, IndividualAmountOfInterest, OrgAmountOfInterest } from '@/server/db/schema';

export const INDIVIDUAL_AMOUNT_OPTIONS: Record<IndividualAmountOfInterest, string> = {
  '1k_10k': '$1k - $10k',
  '10k_100k': '$10k - $100k',
  '100k_250k': '$100k - $250k',
  '250k_1m': '$250k - $1M',
  over_1m: '>$1M'
};

export const ORG_AMOUNT_OPTIONS: Record<OrgAmountOfInterest, string> = {
  under_10k: '< $10k',
  '10k_100k': '$10k - $100k',
  '100k_250k': '$100k - $250k',
  '250k_1m': '$250k - $1M',
  '1m_5m': '$1M - $5M',
  over_5m: '> $5M'
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
