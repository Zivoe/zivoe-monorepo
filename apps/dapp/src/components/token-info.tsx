import { UsdcIcon, ZVltLogo } from '@zivoe/ui/icons';

import { type Token } from '@/types/constants';

export const TOKEN_INFO: Record<Token, { label: string; description: string; icon: React.ReactNode }> = {
  USDC: {
    label: 'USDC',
    description: 'US Dollar Coin',
    icon: <UsdcIcon />
  },
  zMCA: {
    label: 'zMCA',
    description: 'Zivoe MCA',
    icon: <ZVltLogo />
  }
};
