import { NextLink } from '@zivoe/ui/core/link';
import { ArrowRightIcon } from '@zivoe/ui/icons';

import { customNumber } from '@/lib/utils';

import { AcceptedChainIcons, AcceptedStablecoinIcons } from '@/components/offering-icons';
import OfferingIdentity, { OfferingStatusBadge } from '@/components/offering-identity';

import { type Offering, offeringPath } from '@/offerings';

export default function OfferingCard({
  offering,
  aum
}: {
  offering: Offering;
  /** Share-class AUM in USD; null when the indexer read failed. */
  aum: number | null;
}) {
  // Both shadows are ones the rest of the app already uses, and the card rests
  // on the lighter of the two — hover lifts it a step rather than conjuring a
  // shadow out of nothing.
  return (
    <NextLink
      href={offeringPath(offering)}
      className="group flex flex-col overflow-hidden rounded-2xl border border-default bg-surface-base shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)] transition-shadow duration-300 ease-out hover:shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.05),0px_4px_6px_-2px_rgba(16,24,40,0.03)] focus-visible:ring-2 focus-visible:ring-default focus-visible:ring-offset-2 focus-visible:outline-hidden"
    >
      <div className="h-38" style={{ background: offering.cardGradient }} />

      <div className="flex flex-1 flex-col gap-6 p-6">
        <OfferingIdentity offering={offering} trailing={<OfferingStatusBadge status={offering.status} />} />

        <div className="mt-auto rounded-xl bg-surface-elevated px-4 py-1">
          <Term label="Asset Type" value={offering.category} />
          <Term label="Target APY" value={`${offering.targetApyPercent}%`} />
          <Term label="AUM" value={aum !== null ? `$${customNumber(aum)}` : '—'} />
          <Term label="Accepted stablecoin" value={<AcceptedStablecoinIcons />} />
          <Term label="Available on" value={<AcceptedChainIcons offering={offering} />} />
        </div>

        <div className="flex items-center justify-end gap-1.5 text-regular font-medium text-brand-subtle">
          View
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </NextLink>
  );
}

function Term({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-subtle py-3 last:border-b-0">
      <p className="text-small tracking-wide text-tertiary uppercase">{label}</p>
      {typeof value === 'string' ? <p className="text-regular text-primary">{value}</p> : value}
    </div>
  );
}
