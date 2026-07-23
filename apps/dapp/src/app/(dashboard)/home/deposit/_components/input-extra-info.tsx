import { Skeleton } from '@zivoe/ui/core/skeleton';

import { formatBigIntToReadable, formatBigIntWithCommas } from '@/lib/utils';

type Balance = {
  value: bigint | undefined;
  isPending?: boolean;
  /** Token decimals of the balance when they differ from the dollar value's `decimals`. */
  decimals?: number;
};

export function InputExtraInfo({
  decimals,
  dollarValue,
  balance,
  isLoading = false
}: {
  dollarValue: bigint | null;
  decimals: number;
  balance: Balance;
  isLoading?: boolean;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="text-extraSmall font-medium text-tertiary">
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : dollarValue !== null ? (
          `≈ $${formatBigIntWithCommas({ value: dollarValue, tokenDecimals: decimals, displayDecimals: 3 })}`
        ) : null}
      </div>

      <BalanceDisplay decimals={balance.decimals ?? decimals} value={balance.value} isPending={balance.isPending} />
    </div>
  );
}

function BalanceDisplay({ decimals, value, isPending }: { decimals: number; value: bigint | undefined; isPending?: boolean }) {
  if (isPending || value === undefined) return null;
  return (
    <p className="text-extraSmall font-medium text-tertiary">Balance: {formatBigIntToReadable(value, decimals)}</p>
  );
}
