import { formatBigIntWithCommas } from '@/lib/utils';

import { type Amounts, type Portfolio } from '@/portfolio';

/** A token amount from the model's 18-decimal units, two decimals, "<0.01" for dust. */
export const formatAmount = (valueD18: bigint, symbol: string) =>
  `${formatBigIntWithCommas({ value: valueD18, tokenDecimals: 18, displayDecimals: 2, showUnderZero: true })} ${symbol}`;

/** What could not be read, for a sentence: "balances", "positions" or "balances and positions". */
export function failedReadsLabel({
  failedBalanceChains,
  failedPositionChains
}: Pick<Portfolio, 'failedBalanceChains' | 'failedPositionChains'>): string {
  return [failedBalanceChains.length > 0 && 'balances', failedPositionChains.length > 0 && 'positions']
    .filter(Boolean)
    .join(' and ');
}

/** The lines under a balance: what of this coin is in flight, in the hero's own words. */
export function amountNotes(amounts: Amounts, symbol: string): Array<string> {
  const notes: Array<string> = [];
  if (amounts.inRedemption > 0n) notes.push(`${formatAmount(amounts.inRedemption, symbol)} in redemption`);
  if (amounts.readyToClaim > 0n) notes.push(`${formatAmount(amounts.readyToClaim, symbol)} ready to claim`);
  return notes;
}

/**
 * The line under the chart's share figure. The chart plots what the wallet
 * holds while the hero's share figure also counts what sits in the vault, so
 * the line names that difference whenever there is one; `shareAmounts` is
 * undefined until every chain has answered.
 */
export function balanceChartSubtitle({
  shareSymbol,
  shareAmounts
}: {
  shareSymbol: string;
  shareAmounts: Amounts | undefined;
}): string {
  const outside = shareAmounts ? amountNotes(shareAmounts, shareSymbol) : [];
  return `In your wallet${outside.length > 0 ? `, excluding ${outside.join(' and ')}` : ''}`;
}
