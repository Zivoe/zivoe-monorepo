// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WalletChart } from './chart';
import { walletValueAxis } from './chart-axis';

const DAY = 86_400_000;
const nowMs = Date.UTC(2026, 8, 30);
let containerWidth = 375;
let characterWidth = 7;
const measureText = vi.fn((text: string) => ({ width: text.length * characterWidth }));
const context = { font: '', measureText };
let fontReady: () => void;
let fontEvents: EventTarget;
const observers: Array<{ callback: ResizeObserverCallback; disconnected: boolean; element?: Element }> = [];

function history(values: Array<number | null>) {
  return {
    points: values.map((value, index) => ({
      timestampMs: nowMs - (values.length - index - 1) * DAY,
      valueD18: value === null ? null : BigInt(Math.round(value * 10000)) * 10n ** 14n,
      live: index === values.length - 1
    })),
    complete: !values.includes(null),
    missingPrices: values.includes(null)
  };
}

beforeEach(() => {
  characterWidth = 7;
  observers.length = 0;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      entry: (typeof observers)[number];
      constructor(callback: ResizeObserverCallback) {
        this.entry = { callback, disconnected: false };
        observers.push(this.entry);
      }
      observe(element: Element) {
        this.entry.element = element;
      }
      disconnect() {
        this.entry.disconnected = true;
      }
    }
  );
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    width: containerWidth,
    height: 256,
    top: 0,
    left: 0,
    right: containerWidth,
    bottom: 256,
    x: 0,
    y: 0,
    toJSON: () => ({})
  }));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const style = new CSSStyleDeclaration();
  Object.assign(style, {
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: '12px',
    fontFamily: 'Instrument Sans',
    letterSpacing: '0px'
  });
  vi.spyOn(window, 'getComputedStyle').mockReturnValue(style);
  fontEvents = new EventTarget();
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: Object.assign(fontEvents, {
      ready: new Promise<void>((resolve) => {
        fontReady = resolve;
      })
    })
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  Reflect.deleteProperty(document, 'fonts');
});

function renderChart(values: Array<number | null>) {
  return render(
    <WalletChart history={history(values)} nowMs={nowMs} loading={false} error={false} refresh={vi.fn()} />
  );
}

function yTicks(container: HTMLElement) {
  return Array.from(container.querySelectorAll<SVGTextElement>('.recharts-yAxis .recharts-cartesian-axis-tick-value'));
}

describe('zSMB chart layout', () => {
  for (const width of [375, 768, 1440]) {
    it.each([
      [200_000, 200_020],
      [1_140_000, 1_140_040],
      [114_000_000, 114_000_040]
    ])(`keeps labels inside the SVG and aligns gridlines at ${width}px for %s–%s`, (min, max) => {
      // Match the card's responsive horizontal padding and border.
      containerWidth = width - (width < 640 ? 42 : 50);
      const { container } = renderChart([min, max]);
      const ticks = yTicks(container);
      expect(ticks.map((tick) => tick.textContent)).toEqual(walletValueAxis([min, max]).labels);
      const marks = Array.from(
        container.querySelectorAll<SVGLineElement>('.recharts-yAxis .recharts-cartesian-axis-tick-line')
      );
      const grid = Array.from(container.querySelectorAll<SVGLineElement>('.recharts-cartesian-grid-horizontal line'));
      expect(grid).toHaveLength(ticks.length);
      const longest = Math.max(...ticks.map((tick) => tick.textContent!.length * characterWidth));
      const gutter = Number(grid[0]!.getAttribute('x1'));
      expect(gutter).toBe(longest + 20);
      for (const [index, tick] of ticks.entries()) {
        const x = Number(tick.getAttribute('x'));
        const y = Number(tick.getAttribute('y'));
        expect(x - tick.textContent!.length * characterWidth).toBeGreaterThanOrEqual(0);
        expect(x).toBeLessThan(containerWidth);
        const mark = marks[index]!;
        expect(Number(mark.getAttribute('x2')) - Number(mark.getAttribute('x1'))).toBe(4);
        expect(Number(mark.getAttribute('x1')) - x).toBe(8);
        expect(Number(grid[index]!.getAttribute('y1'))).toBe(y);
        if (index > 0) expect(Number(ticks[index - 1]!.getAttribute('y')) - y).toBeGreaterThan(16);
      }
      expect(container.querySelector('.recharts-yAxis .recharts-cartesian-axis-line')).toBeNull();
      const curve = container.querySelector('.recharts-area-curve')!.getAttribute('d')!;
      const points = Array.from(curve.matchAll(/[ML]([\d.]+),([\d.]+)/g), (match) => Number(match[2]));
      expect(points).toHaveLength(2);
      expect(points[0]).toBeCloseTo(8 + (256 - 30 - 8) * 0.85, 2);
      expect(points[1]).toBeCloseTo(8 + (256 - 30 - 8) * 0.15, 2);
      const chart = container.querySelector('[data-chart]')!;
      expect(chart.className).not.toContain('-ml-4');
      expect(chart.className).not.toContain('calc(100%');
    });
  }

  it('uses a conservative character estimate when canvas measurement is unavailable', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { container } = renderChart([114_000_000, 114_000_040]);
    expect(Number(container.querySelector('.recharts-cartesian-grid-horizontal line')!.getAttribute('x1'))).toBe(108);
  });

  it('remeasures with the chart font after fonts load and on resize, and disconnects on unmount', async () => {
    containerWidth = 375;
    const { container, unmount } = renderChart([114_000_000, 114_000_040]);
    const gutter = () =>
      Number(container.querySelector('.recharts-cartesian-grid-horizontal line')!.getAttribute('x1'));
    expect(context.font).toBe('normal 400 12px Instrument Sans');
    expect(gutter()).toBe(97);
    characterWidth = 8;
    await act(async () => {
      fontReady();
    });
    expect(gutter()).toBe(108);
    characterWidth = 9;
    act(() => {
      fontEvents.dispatchEvent(new Event('loadingdone'));
    });
    expect(gutter()).toBe(119);
    characterWidth = 7;
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(gutter()).toBe(97);
    characterWidth = 8;
    act(() => {
      observers.find((observer) => observer.element?.hasAttribute('data-chart'))!.callback([], {} as ResizeObserver);
    });
    expect(gutter()).toBe(108);
    unmount();
    expect(observers.every((observer) => observer.disconnected)).toBe(true);
    measureText.mockClear();
    fontEvents.dispatchEvent(new Event('loadingdone'));
    window.dispatchEvent(new Event('resize'));
    expect(measureText).not.toHaveBeenCalled();
  });

  it('leaves missing points unconnected and preserves headline and range controls', () => {
    const { container } = renderChart([200_000, null, 200_020]);
    expect(screen.getByText('$200,020.00')).toBeTruthy();
    expect(screen.getByRole('button', { name: '30D' }).getAttribute('aria-pressed')).toBe('true');
    expect(yTicks(container).map((tick) => tick.textContent)).toEqual(walletValueAxis([200_000, 200_020]).labels);
    expect(container.querySelector('.recharts-area-curve')?.getAttribute('d')).not.toContain('L');
    expect(screen.getByText(/Some historical Token Prices are missing/)).toBeTruthy();
  });
});
