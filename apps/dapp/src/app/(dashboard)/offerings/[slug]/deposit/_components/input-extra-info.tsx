import { Skeleton } from '@zivoe/ui/core/skeleton';

import { formatBigIntToReadable, formatBigIntWithCommas } from '@/lib/utils';

/**
 * The dollar line and the balance line each carry their own scale — the two
 * routinely differ (an 18-decimal dollar value beside an 8-decimal share
 * balance), and a shared default once hid exactly that mismatch.
 */
export function InputExtraInfo({
  dollarValueDecimals,
  dollarValue,
  balance,
  isLoading = false
}: {
  dollarValue: bigint | null;
  dollarValueDecimals: number;
  balance: { value: bigint | undefined; decimals: number; isPending?: boolean };
  isLoading?: boolean;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="text-extraSmall font-medium text-tertiary">
        {isLoading ? (
          <Skeleton className="h-4 w-16" />
        ) : dollarValue !== null ? (
          `≈ $${formatBigIntWithCommas({ value: dollarValue, tokenDecimals: dollarValueDecimals, displayDecimals: 3 })}`
        ) : null}
      </div>

      <BalanceDisplay decimals={balance.decimals} value={balance.value} isPending={balance.isPending} />
    </div>
  );
}

function BalanceDisplay({
  decimals,
  value,
  isPending
}: {
  decimals: number;
  value: bigint | undefined;
  isPending?: boolean;
}) {
  if (isPending || value === undefined) return null;
  return (
    <p className="text-extraSmall font-medium text-tertiary">Balance: {formatBigIntToReadable(value, decimals)}</p>
  );
}
