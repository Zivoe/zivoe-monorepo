// Money formatting shared by every stats surface (dApp and landing), so one
// NAV or Token Price can never print two ways.

/** Truncates toward zero at `decimals` places, absorbing float noise first. */
export const floorToDecimals = (num: number, decimals = 2) => {
  const multiplier = Math.pow(10, decimals);
  // Scaling first introduces representation error (1.14 * 100 is
  // 113.99999999999999), which floors a whole display unit off the value.
  // Round that noise away before flooring: anything within 5e-7 of the next
  // step rounds up — wide enough to absorb bigint-D18 / 1e18 conversion
  // noise, yet far enough below display precision that genuine near-boundary
  // values still truncate down.
  return Math.floor(Math.round(num * multiplier * 1e6) / 1e6) / multiplier;
};

// NAV displays: the full dollar amount with separators, truncated to whole
// dollars (values arrive as navD18 / 1e18).
export const formatNav = (nav: number) => floorToDecimals(nav, 0).toLocaleString('en-US');

// Token price displays: truncated at 4 decimals, trailing zeros trimmed down
// to the familiar 2-decimal money shape (1.12345 -> 1.1234, 1.13 -> 1.13).
export const formatTokenPrice = (price: number) =>
  floorToDecimals(price, 4)
    .toFixed(4)
    .replace(/(\.\d{2}\d*?)0+$/, '$1');
