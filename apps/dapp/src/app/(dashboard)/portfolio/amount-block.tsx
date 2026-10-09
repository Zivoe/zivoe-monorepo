import { formatUsdD18 } from '@/lib/utils';

import TextSkeleton from '@/components/text-skeleton';

import { type Amounts } from '@/portfolio';

import { amountNotes, formatAmount } from './format';

/**
 * A coin's figures, right-aligned: the wallet balance, then what of the coin
 * is in flight, then the USD value of all of it. Shared by the Tokens rows and
 * the per-network dialog so the two never print the same money differently.
 */
export function AmountBlock({
  amounts,
  symbol,
  valueD18
}: {
  amounts: Amounts;
  symbol: string;
  /** Null only for the share token while its price is on its way. */
  valueD18: bigint | null;
}) {
  const notes = amountNotes(amounts, symbol);

  return (
    <div className="flex flex-col items-end text-right">
      <p className="text-regular font-medium text-primary tabular-nums">{formatAmount(amounts.wallet, symbol)}</p>
      {notes.map((note) => (
        <p key={note} className="text-extraSmall text-secondary tabular-nums">
          {note}
        </p>
      ))}
      <p className="text-small text-secondary tabular-nums">
        {valueD18 === null ? (
          <TextSkeleton className="w-16" />
        ) : notes.length > 0 ? (
          `${formatUsdD18(valueD18)} in total`
        ) : (
          formatUsdD18(valueD18)
        )}
      </p>
    </div>
  );
}
