import Image from 'next/image';

import { NextLink } from '@zivoe/ui/core/link';
import { ArrowRightIcon } from '@zivoe/ui/icons';

import { customNumber } from '@/lib/utils';

import { AcceptedChainIcons, AcceptedStablecoinIcons } from '@/components/offering-icons';
import OfferingIdentity, { OfferingStatusBadge } from '@/components/offering-identity';
import TargetApyDisclosure from '@/components/target-apy-disclosure';

import { type Offering, offeringPath } from '@/offerings';

export default function OfferingCard({
  offering,
  nav
}: {
  offering: Offering;
  /** Share-class NAV in USD; null when the indexer read failed. */
  nav: number | null;
}) {
  // Both shadows are ones the rest of the app already uses, and the card rests
  // on the lighter of the two — hover lifts it a step rather than conjuring a
  // shadow out of nothing.
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-default bg-surface-base shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)] transition-shadow duration-300 ease-out hover:shadow-[0px_12px_16px_-4px_rgba(16,24,40,0.05),0px_4px_6px_-2px_rgba(16,24,40,0.03)]">
      <NextLink
        href={offeringPath(offering)}
        aria-label={`View ${offering.name}`}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:ring-2 focus-visible:ring-default focus-visible:outline-hidden focus-visible:ring-inset"
      />

      <div className="relative h-38">
        <Image
          fill
          alt=""
          src={offering.cardArtworkSrc}
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
        />
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6">
        <OfferingIdentity offering={offering} trailing={<OfferingStatusBadge status={offering.status} />} />

        <div className="mt-auto rounded-xl bg-surface-elevated px-4 py-1">
          <Term label="Asset Type" value={offering.category} />
          <Term
            label="Target APY"
            value={`${offering.targetApyPercent}%`}
            help={<TargetApyDisclosure triggerClassName="relative z-20" />}
          />
          <Term label="NAV" value={nav !== null ? `$${customNumber(nav)}` : '—'} />
          <Term label="Accepted stablecoin" value={<AcceptedStablecoinIcons />} />
          <Term label="Available on" value={<AcceptedChainIcons offering={offering} />} />
        </div>

        <div className="flex items-center justify-end gap-1.5 text-regular font-medium text-brand-subtle">
          View
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </div>
  );
}

function Term({ label, value, help }: { label: string; value: React.ReactNode; help?: React.ReactNode }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 border-b border-subtle py-3 last:border-b-0">
      <div className="flex items-center">
        <p className="text-small tracking-wide text-tertiary uppercase">{label}</p>
        {help}
      </div>
      {typeof value === 'string' ? <p className="text-regular text-primary">{value}</p> : value}
    </div>
  );
}
