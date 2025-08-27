import { FrxUsdIcon, UsdcIcon, UsdtIcon, ZVltLogo, ZsttIcon } from '@zivoe/ui/icons';

import { Token } from '@/types/constants';

export const TOKEN_INFO: Record<Token, { label: string; description: string; icon: React.ReactNode }> = {
  zVLT: {
    label: 'zVLT',
    description: 'Zivoe Vault',
    icon: <ZVltLogo />
  },
  USDC: {
    label: 'USDC',
    description: 'US Dollar Coin',
    icon: <UsdcIcon />
  },
  USDT: {
    label: 'USDT',
    description: 'Tether USD',
    icon: <UsdtIcon />
  },
  frxUSD: {
    label: 'frxUSD',
    description: 'Frax USD',
    icon: <FrxUsdIcon />
  },
  zSTT: {
    label: 'zSTT',
    description: 'Senior Tranche Token (Legacy)',
    icon: <ZsttIcon />
  }
};
