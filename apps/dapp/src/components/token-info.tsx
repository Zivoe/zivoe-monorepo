import { UsdcIcon } from '@zivoe/ui/icons';

import { type DepositToken, type ShareToken, type Token } from '@/types/constants';

import { OFFERINGS } from '@/offerings';

type TokenInfo = { label: string; description: string; icon: React.ReactNode };

const DEPOSIT_TOKEN_INFO: Record<DepositToken, TokenInfo> = {
  USDC: {
    label: 'USDC',
    description: 'US Dollar Coin',
    icon: <UsdcIcon />
  }
};

// One display entry per registered share token, derived from the Offering
// modules so adding a class can never leave the map incomplete. The cast
// asserts what the compiler cannot see across Object.fromEntries: every
// ShareToken symbol comes from exactly one registered Offering.
const SHARE_TOKEN_INFO = Object.fromEntries(
  OFFERINGS.map((offering) => [
    offering.shareClass.symbol,
    { label: offering.shareClass.symbol, description: offering.shareTokenDescription, icon: <offering.Logo /> }
  ])
) as Record<ShareToken, TokenInfo>;

export const TOKEN_INFO: Record<Token, TokenInfo> = { ...DEPOSIT_TOKEN_INFO, ...SHARE_TOKEN_INFO };
