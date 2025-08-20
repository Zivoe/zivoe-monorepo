import { formatBigIntToReadable, formatBigIntWithCommas } from '@/lib/utils';

type Balance = {
  value: bigint | undefined;
  isPending?: boolean;
};

export function InputExtraInfo({
  decimals,
  dollarValue,
  balance
}: {
  dollarValue: bigint | null;
  decimals: number;
  balance: Balance;
}) {
  return (
    <div className="flex w-full items-center justify-between">
      <div className="text-extraSmall font-medium text-tertiary">
        {dollarValue !== null ? `≈ $${formatBigIntWithCommas({ value: dollarValue, tokenDecimals: decimals })}` : null}
      </div>

      <BalanceDisplay decimals={decimals} {...balance} />
    </div>
  );
}

export function BalanceDisplay({ decimals, value, isPending }: Balance & { decimals: number }) {
  if (isPending || value === undefined) return null;
  return (
    <p className="text-extraSmall font-medium text-tertiary">Balance: {formatBigIntToReadable(value, decimals)}</p>
  );
}
