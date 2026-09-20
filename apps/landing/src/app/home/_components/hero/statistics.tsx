'use client';

import { type ReactNode, useEffect, useState } from 'react';

import { type CentrifugeChain } from '@zivoe/centrifuge-indexer';
import { cn } from '@zivoe/ui/lib/tw-utils';

import {
  HOME_METRICS_REFRESH_MS,
  type HomeMetric,
  type HomeMetrics,
  STATISTIC_DISCLOSURE,
  formatNav,
  formatTokenPrice,
  homeMetricsSchema,
  mergeMetric,
  metricTime,
  unavailableMetric
} from '@/lib/home-metrics';

import { MetricHelp } from './metric-help';
import { AvailableNetworks, MetricLink } from './metric-links';

const emptyMetrics: HomeMetrics = {
  nav: unavailableMetric,
  tokenPrice: unavailableMetric
};

export function Statistics({ chains, centrifugeUrl }: { chains: Array<CentrifugeChain>; centrifugeUrl: string }) {
  const [metrics, setMetrics] = useState<HomeMetrics>(emptyMetrics);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let disposed = false;
    let pending = false;
    let controller: AbortController | undefined;
    const refresh = async () => {
      if (document.visibilityState === 'hidden' || pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20_000);
      try {
        const response = await fetch('/api/home-metrics', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Metrics unavailable');
        const next = homeMetricsSchema.parse(await response.json());
        if (!disposed)
          setMetrics((previous) => ({
            nav: mergeMetric(previous.nav, next.nav),
            tokenPrice: mergeMetric(previous.tokenPrice, next.tokenPrice)
          }));
      } catch {
        if (!disposed)
          setMetrics((previous) => ({
            nav: mergeMetric(previous.nav, unavailableMetric),
            tokenPrice: mergeMetric(previous.tokenPrice, unavailableMetric)
          }));
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (!disposed) setLoading(false);
      }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), HOME_METRICS_REFRESH_MS);
    const onVisible = () => void refresh();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      disposed = true;
      controller?.abort();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return (
    <div aria-label="Live zSMB metrics" className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <Statistic
        label="NAV"
        metric={metrics.nav}
        loading={loading}
        format={formatNav}
        definition="Net asset value of zSMB: the sum of outstanding token supply on each network multiplied by that network’s published token price."
        sourceLabel="Oldest network price publication"
        footer={<AvailableNetworks chains={chains} />}
      />
      <Statistic
        label="Token Price"
        metric={metrics.tokenPrice}
        loading={loading}
        format={formatTokenPrice}
        definition="The latest manager-published USD price per zSMB token for the share class, as shown in Lighthouse."
        sourceLabel="Price published"
        footer={<MetricLink href={centrifugeUrl}>CentrifugeScan</MetricLink>}
      />
    </div>
  );
}

function Statistic({
  label,
  metric,
  loading,
  format,
  definition,
  sourceLabel,
  footer
}: {
  label: string;
  metric: HomeMetric;
  loading: boolean;
  format: (value: string) => string;
  definition: string;
  sourceLabel: string;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-w-0 flex-col rounded-xl border border-primary-900/15 bg-linear-to-br from-tertiary-100/95 to-tertiary-200/80 p-3 text-primary shadow-[0_12px_28px_-18px_rgba(13,75,78,0.35),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-sm sm:p-4">
      <span className="absolute top-3 right-3 inline-flex h-5 items-center gap-1 rounded-full border border-[#64c3c2]/30 bg-[#a3dbd6]/25 px-2 text-[0.625rem] leading-none font-medium text-[#13595c] sm:top-4 sm:right-4">
        <span aria-hidden="true" className="size-1.25 rounded-full bg-[#64c3c2]/75" />
        On-Chain
      </span>
      <div className="flex items-center gap-0.5 pr-22">
        <p className="text-small whitespace-nowrap text-primary/80">{label}</p>
        <MetricHelp label={label}>
          <p>{definition}</p>
          {metric.status !== 'unavailable' ? (
            <p className="text-primary/75">
              {sourceLabel}: {metricTime(metric.sourceAt)}.<br />
              {'indexedAt' in metric && metric.indexedAt && (
                <>
                  Oldest indexed block: {metricTime(metric.indexedAt)}.<br />
                </>
              )}
              Last successful reading: {metricTime(metric.observedAt)}.
              {metric.status === 'stale' && ' Refresh unavailable; showing the last successful reading.'}
            </p>
          ) : (
            <p>{loading ? 'Loading source timestamps…' : 'Source timestamps are unavailable.'}</p>
          )}
          <p>{STATISTIC_DISCLOSURE}</p>
        </MetricHelp>
      </div>
      <p
        aria-live="polite"
        aria-atomic="true"
        className={cn(
          'mt-2 font-heading tracking-[-0.04em] tabular-nums',
          metric.status === 'unavailable' ? 'text-xl' : 'text-[1.75rem] leading-tight sm:text-[2.25rem]'
        )}
      >
        {metric.status === 'unavailable' ? (loading ? 'Loading…' : 'Unavailable') : format(metric.value)}
      </p>
      {metric.status === 'stale' && (
        <p className="text-xs mt-2 leading-relaxed text-primary/75">
          Stale · last read {metricTime(metric.observedAt)}
        </p>
      )}
      <div className="mt-2 text-[0.8125rem] leading-5">{footer}</div>
    </div>
  );
}
