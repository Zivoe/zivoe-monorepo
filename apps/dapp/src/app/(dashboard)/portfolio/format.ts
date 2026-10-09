import { formatBigIntWithCommas, formatUsdD18 } from '@/lib/utils';

import { type Amounts, type BalanceChange, type HistoryRange, type Portfolio } from '@/portfolio';

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
 * What follows the chart's share figure: "in your wallet, excluding …". The
 * chart plots what the wallet holds while the hero's share figure also counts
 * what sits in the vault, so the line names that difference whenever there
 * is one; `shareAmounts` is undefined until every chain has answered.
 */
export function balanceChartSubtitle({
  shareSymbol,
  shareAmounts
}: {
  shareSymbol: string;
  shareAmounts: Amounts | undefined;
}): string {
  const outside = shareAmounts ? amountNotes(shareAmounts, shareSymbol) : [];
  return `in your wallet${outside.length > 0 ? `, excluding ${outside.join(' and ')}` : ''}`;
}

const RANGE_CAPTIONS: Record<HistoryRange, string> = {
  '7D': 'past 7 days',
  '30D': 'past 30 days',
  '90D': 'past 90 days',
  '1Y': 'past year',
  All: 'all time'
};

/**
 * The change pill beside the chart's headline: "+$12.40 (+1.03%)" and, for
 * screen readers, the range it covers, "past 30 days". Signed like a ticker,
 * so the sign is never lost in the formatting; a percent only when the model
 * gave one.
 */
export function balanceChangeLine({ change, range }: { change: BalanceChange; range: HistoryRange }): {
  figure: string;
  caption: string;
} {
  const sign = change.deltaD18 > 0n ? '+' : '';
  const percent =
    change.percent === undefined ? '' : ` (${change.percent > 0 ? '+' : ''}${change.percent.toFixed(2)}%)`;
  return { figure: `${sign}${formatUsdD18(change.deltaD18)}${percent}`, caption: RANGE_CAPTIONS[range] };
}
