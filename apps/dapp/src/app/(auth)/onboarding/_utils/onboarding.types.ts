import type { AmountOfInterest, HowFoundZivoe } from '@/server/db/schema';

export const AMOUNT_OF_INTEREST_OPTIONS: Record<AmountOfInterest, string> = {
  under_1k: '<$1k',
  '10k_100k': '$10k - $100k',
  '100k_250k': '$100k - $250k',
  '250k_1m': '$250k - $1M',
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
