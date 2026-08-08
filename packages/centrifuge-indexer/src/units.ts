/** Ray (1e27) is the indexer's fixed-point scale for yield fractions: 1e27 = 100%. */
const RAY_PER_PERCENT = 1e25;

/**
 * Display percent from a Ray-scale yield (5% arrives as 0.05 * 1e27). The
 * Number() conversion is correctly rounded, so display precision is unaffected.
 */
export function rayToPercent(value: bigint): number {
  return Number(value) / RAY_PER_PERCENT;
}

/**
 * 18-decimal USD NAV of a share class: an 18-decimal Token Price times the
 * issuance in token base units, with the token's own decimals divided out.
 * The one formula every NAV surface shares — the aggregate read and the
 * current-metrics read must agree because fallbacks compare them.
 */
export function navD18({
  tokenPrice,
  totalIssuance,
  decimals
}: {
  tokenPrice: bigint;
  totalIssuance: bigint;
  decimals: number;
}): bigint {
  return (tokenPrice * totalIssuance) / 10n ** BigInt(decimals);
}
