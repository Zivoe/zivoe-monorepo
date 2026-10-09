import { formatBigIntWithCommas, formatUsdD18 } from '@/lib/utils';

import { stepDecimals } from '@/components/chart/axis';

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

const CENT = 10n ** 16n;

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
 * gave one. A move under a cent (a small wallet's week of yield) says so
 * rather than printing "$0.00" beside a non-zero percent.
 */
export function balanceChangeLine({ change, range }: { change: BalanceChange; range: HistoryRange }): {
  figure: string;
  caption: string;
} {
  const magnitude = change.deltaD18 < 0n ? -change.deltaD18 : change.deltaD18;
  const underCent = magnitude > 0n && magnitude < CENT;
  const sign = change.deltaD18 < 0n ? '-' : change.deltaD18 > 0n && !underCent ? '+' : '';
  const amount = underCent ? '<$0.01' : formatUsdD18(magnitude);
  const percent =
    change.percent === undefined ? '' : ` (${change.percent > 0 ? '+' : ''}${change.percent.toFixed(2)}%)`;
  return { figure: `${sign}${amount}${percent}`, caption: RANGE_CAPTIONS[range] };
}

/**
 * A gridline's label: the full figure with thousands separators and the
 * step's decimals, no currency sign. Not the vault chart's compact "1.14M":
 * a tight window on a large balance steps by hundreds, and the compact form
 * would print the same label on every line.
 */
export function axisTickLabel({ value, step }: { value: number; step: number }): string {
  const decimals = step >= 1 ? 0 : stepDecimals(step);
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
