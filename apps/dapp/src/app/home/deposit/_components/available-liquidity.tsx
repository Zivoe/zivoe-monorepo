'use client';

import { ZapIcon } from '@zivoe/ui/icons';

import { NETWORK } from '@/lib/constants';
import { formatBigIntWithCommas } from '@/lib/utils';

import { useAvailableLiquidity } from '../_hooks/useAvailableLiquidity';

export default function AvailableLiquidity() {
  const liquidity = useAvailableLiquidity();

  if (liquidity.isPending || liquidity.data === undefined) return null;

  const formatted = formatBigIntWithCommas({
    value: liquidity.data,
    tokenDecimals: NETWORK === 'MAINNET' ? 6 : 18
  });

  return (
    <div className="mt-5 hidden gap-3 rounded-md bg-element-primary-light px-6 py-4 lg:flex">
      <ZapIcon className="size-6 text-primary-subtle" />

      <div className="flex flex-col gap-1">
        <p className="text-leading font-medium text-primary-subtle">Instant Liquidity Is Now Available</p>
        <p className="text-regular text-primary-subtle">Redeem up to ${formatted}</p>
      </div>
    </div>
  );
}
