/** Ray (1e27) is the indexer's fixed-point scale for yield fractions: 1e27 = 100%. */
const RAY_PER_PERCENT = 1e25;

/**
 * Display percent from a Ray-scale yield (5% arrives as 0.05 * 1e27). The
 * Number() conversion is correctly rounded, so display precision is unaffected.
 */
export function rayToPercent(value: bigint): number {
  return Number(value) / RAY_PER_PERCENT;
}
