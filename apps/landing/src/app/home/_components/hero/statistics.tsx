import { type ReactNode } from 'react';

import { type CentrifugeChain, type ShareStatsPayload } from '@zivoe/centrifuge-indexer';
import { ContextualHelp, ContextualHelpDescription } from '@zivoe/ui/core/contextual-help';
import { formatNav, formatTokenPrice } from '@zivoe/ui/lib/format';

import { AvailableNetworks, MetricLink } from './metric-links';

const STATISTIC_DISCLOSURE =
  'Live platform metrics, rounded for presentation purposes. Past performance is not indicative of future results. For informational purposes only; this is not an offer to sell or a solicitation of an offer to buy any security or financial product.';

const utcTime = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' });

/** Server-rendered zSMB figures; `metrics` is undefined when the indexer read failed (already captured). */
export function Statistics({
  metrics,
  chains,
  centrifugeScanUrl
}: {
  metrics: ShareStatsPayload | undefined;
  chains: Array<CentrifugeChain>;
  centrifugeScanUrl?: string;
}) {
  const sourceNote = metrics
    ? `Price published ${utcTime.format(new Date(metrics.priceComputedAtMs))} UTC.`
    : 'Live figures are temporarily unavailable.';

  // Equal columns: the NAV footer is sized so its chips fit beside the label at desktop widths.
  return (
    <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
      <Statistic
        label="NAV"
        value={metrics && `$${formatNav(Number(metrics.navD18) / 1e18)}`}
        definition="Net asset value of zSMB: Token Price multiplied by the outstanding token supply."
        sourceNote={sourceNote}
        footer={<AvailableNetworks chains={chains} />}
      />
      <Statistic
        label="Token Price"
        value={metrics && `$${formatTokenPrice(Number(metrics.sharePriceD18) / 1e18)}`}
        definition="The latest manager-published USD price per zSMB token."
        sourceNote={sourceNote}
        footer={centrifugeScanUrl && <MetricLink href={centrifugeScanUrl}>CentrifugeScan</MetricLink>}
      />
    </div>
  );
}

function Statistic({
  label,
  value,
  definition,
  sourceNote,
  footer
}: {
  label: string;
  value: string | undefined;
  definition: string;
  sourceNote: string;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-w-0 flex-col rounded-xl border border-default bg-element-tertiary-gentle p-3 text-primary sm:p-4">
      <span className="absolute top-3 right-3 inline-flex h-5 items-center gap-1 rounded-full bg-element-primary-gentle px-2 text-tiny font-medium text-brand-subtle sm:top-4 sm:right-4">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-primary-500" />
        On-Chain
      </span>

      <div className="flex items-center pr-22">
        <p className="text-small whitespace-nowrap text-primary/80">{label}</p>
        <ContextualHelp
          variant="info"
          aria-label={`About ${label}`}
          className="w-72 max-w-[calc(100vw-2rem)]"
          triggerClassName="text-primary/80"
        >
          <ContextualHelpDescription>{definition}</ContextualHelpDescription>
          <ContextualHelpDescription>{sourceNote}</ContextualHelpDescription>
          <ContextualHelpDescription>{STATISTIC_DISCLOSURE}</ContextualHelpDescription>
        </ContextualHelp>
      </div>

      <p className="mt-2 text-h5 tabular-nums sm:text-h4">
        {value ?? (
          <>
            <span aria-hidden="true">—</span>
            <span className="sr-only">Unavailable</span>
          </>
        )}
      </p>

      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}
