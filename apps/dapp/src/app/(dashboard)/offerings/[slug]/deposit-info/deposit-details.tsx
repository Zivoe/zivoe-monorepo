import { Link } from '@zivoe/ui/core/link';
import { DocumentIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import InfoSection from '@/components/info-section';

import { OFFERING_DETAIL_LABELS, type Offering, type OfferingDetailValue } from '@/offerings';

import { offeringNetworkDisplays } from '../../../_offerings/network-display';

export default function DepositDetails({ offering }: { offering: Offering }) {
  const { details } = offering;
  // Derived from the catalog, like the listing card's network chips — the two
  // surfaces render the same fact and must never disagree.
  const availableNetworks = offeringNetworkDisplays(offering)
    .map((display) => display.label)
    .join(', ');

  return (
    <InfoSection title="Details" icon={<DocumentIcon />}>
      <div>
        {OFFERING_DETAIL_LABELS.map((label) => (
          <Element
            key={label}
            title={label}
            value={details[label]}
            className="border-b border-default last:border-b-0"
          />
        ))}
        <Element
          title="Available Networks"
          value={availableNetworks}
          className="border-b border-default last:border-b-0"
        />
      </div>
    </InfoSection>
  );
}

function Element({ title, value, className }: { title: string; value: OfferingDetailValue; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-2 py-3 sm:px-3 sm:py-4', className)}>
      <p className="text-small text-secondary sm:text-regular md:text-leading">{title}</p>
      {typeof value === 'string' ? (
        <p className="text-right text-small text-primary sm:text-regular md:text-leading">{value}</p>
      ) : (
        <Link href={value.href} target="_blank" className="text-small sm:text-regular md:text-leading">
          {value.label}
        </Link>
      )}
    </div>
  );
}
