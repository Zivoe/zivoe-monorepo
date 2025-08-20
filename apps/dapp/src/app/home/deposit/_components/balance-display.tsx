import { formatBigIntToReadable } from '@/lib/utils';

type BalanceDisplayProps = {
  balance: bigint | undefined;
  decimals: number;
  isPending?: boolean;
};

export function BalanceDisplay({ balance, decimals, isPending }: BalanceDisplayProps) {
  if (isPending || balance === undefined) return null;

  return <p className="text-small text-primary">Balance: {formatBigIntToReadable(balance, decimals)}</p>;
}
