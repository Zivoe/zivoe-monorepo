const units = [
  { divisor: 1e12, suffix: 'T' },
  { divisor: 1e9, suffix: 'B' },
  { divisor: 1e6, suffix: 'M' },
  { divisor: 1e3, suffix: 'K' },
  { divisor: 1, suffix: '' }
];

function walletValueDomain([min, max]: [number, number]): [number, number] {
  // The observed range fills 70% of the plot, leaving 15% above and below.
  // A flat history is centered in a nonzero domain instead.
  const spread = max - min;
  const padding = spread > 0 ? (spread * 0.15) / 0.7 : Math.max(Math.abs(min) * 0.05, 0.01);
  return [min - padding, max + padding];
}

export function walletValueAxis(values: Array<number | null>) {
  const known = values.filter((value): value is number => value !== null && Number.isFinite(value));
  const extrema = known.reduce<[number, number]>(
    ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
    [Infinity, -Infinity]
  );
  const domain = walletValueDomain(known.length ? extrema : [0, 0]);
  const target = (domain[1] - domain[0]) / 4;
  const exponent = Math.floor(Math.log10(target));
  let step = 0;
  let stepDecimals = 0;
  // Include the adjacent decades so the nearest step can cross a power of ten.
  for (let power = exponent - 1; power <= exponent + 1; power++) {
    for (const factor of [1, 2, 2.5, 5]) {
      const candidate = Number(`${factor}e${power}`);
      const distance = Math.abs(candidate - target);
      const bestDistance = Math.abs(step - target);
      if (distance < bestDistance || Math.abs(distance - bestDistance) <= target * Number.EPSILON * 4) {
        step = candidate;
        stepDecimals = Math.max(0, -power + (factor === 2.5 ? 1 : 0));
      }
    }
  }

  const ticks: Array<number> = [];
  const firstIndex = Math.ceil(domain[0] / step);
  const count = Math.floor(domain[1] / step) - firstIndex + 1;
  for (let offset = 0; offset < count; offset++) {
    // Round multiplication noise at the step's decimal place and remove -0.
    const tick = Number(((firstIndex + offset) * step).toFixed(stepDecimals)) || 0;
    if (tick >= domain[0] && tick <= domain[1] && tick !== ticks.at(-1)) ticks.push(tick);
  }
  const magnitude = ticks.reduce((max, tick) => Math.max(max, Math.abs(tick)), 0);
  const unit = units.find(({ divisor }) => magnitude >= divisor) ?? units[units.length - 1]!;
  const scaledStep = step / unit.divisor;
  let precision = 0;
  while (precision < 100 && Math.abs(Number(scaledStep.toFixed(precision)) - scaledStep) > scaledStep * 1e-10) {
    precision++;
  }
  const makeFormatter = () => {
    const dollars = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: precision,
      maximumFractionDigits: precision
    });
    return (value: number) => dollars.format(Number((value / unit.divisor).toFixed(precision)) || 0) + unit.suffix;
  };
  let formatTick = makeFormatter();
  while (precision < 100 && new Set(ticks.map(formatTick)).size !== ticks.length) {
    precision++;
    formatTick = makeFormatter();
  }
  return { domain, ticks, step, formatTick, labels: ticks.map(formatTick) };
}
