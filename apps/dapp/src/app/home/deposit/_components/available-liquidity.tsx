'use client';

import { ZapIcon } from '@zivoe/ui/icons';

import { CONTRACTS, NETWORK } from '@/lib/constants';
import { formatBigIntWithCommas } from '@/lib/utils';

import { useAccountBalance } from '@/hooks/useAccountBalance';
import { useBalance } from '@/hooks/useBalance';

export default function AvailableLiquidity() {
  const balance = useBalance({
    tokenAddress: CONTRACTS.aUSDC,
    accountAddress: CONTRACTS.OCR
  });

  if (balance.isPending || balance.data === undefined) return null;

  const balanceFormatted = formatBigIntWithCommas({
    value: balance.data,
    tokenDecimals: NETWORK === 'MAINNET' ? 6 : 18
  });

  return (
    <div className="mt-5 hidden gap-3 rounded-md bg-element-primary-light px-6 py-4 lg:flex">
      <ZapIcon className="size-6 text-primary-subtle" />

      <div className="flex flex-col gap-1">
        <p className="text-leading font-medium text-primary-subtle">Instant Liquidity Is Now Available</p>
        <p className="text-regular text-primary-subtle">Redeem up to ${balanceFormatted}</p>
      </div>
    </div>
  );
}
