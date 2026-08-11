import { type ReactNode } from 'react';

import { SHARE_CLASS_CATALOG } from '@zivoe/centrifuge-indexer';
import { ContextualHelp, ContextualHelpDescription } from '@zivoe/ui/core/contextual-help';
import { DocumentIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import InfoSection from '@/components/info-section';
import { AcceptedChainIcons, AcceptedStablecoinIcons } from '@/components/offering-icons';

import { type DerivedDetailLabel, OFFERING_DETAIL_LABELS, type Offering, type OfferingDetailLabel } from '@/offerings';

/** Row notes, shown as an info popover — fixed copy, the same for every Offering. */
const DETAIL_NOTES: Partial<Record<OfferingDetailLabel, string>> = {
  Redemptions: 'Subject to available liquidity'
};

export default function DepositDetails({ offering }: { offering: Offering }) {
  // Rows whose fact the catalog or another Offering field already owns —
  // derived here, like the listing card derives them, so the two surfaces
  // render one source and can never disagree.
  const derived: Record<DerivedDetailLabel, ReactNode> = {
    Issuer: offering.issuer,
    Ticker: SHARE_CLASS_CATALOG[offering.shareClass.key].symbol,
    'Asset Type': offering.category,
    'Accepted stablecoin': <AcceptedStablecoinIcons />,
    'Accepted chains': <AcceptedChainIcons offering={offering} />
  };

  const values: Record<OfferingDetailLabel, ReactNode> = { ...offering.details, ...derived };

  return (
    <InfoSection title="Details" icon={<DocumentIcon />}>
      <div>
        {OFFERING_DETAIL_LABELS.map((label) => (
          <Element
            key={label}
            title={label}
            note={DETAIL_NOTES[label]}
            value={values[label]}
            className="border-b border-default last:border-b-0"
          />
        ))}
      </div>
    </InfoSection>
  );
}

function Element({
  title,
  note,
  value,
  className
}: {
  title: string;
  note?: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-2 py-3 sm:px-3 sm:py-4', className)}>
      <div className="flex items-center">
        <p className="text-small text-secondary sm:text-regular md:text-leading">{title}</p>
        {note ? (
          <ContextualHelp variant="info" aria-label={`About ${title}`}>
            <ContextualHelpDescription>{note}</ContextualHelpDescription>
          </ContextualHelp>
        ) : null}
      </div>

      {typeof value === 'string' ? (
        <p className="text-right text-small text-primary sm:text-regular md:text-leading">{value}</p>
      ) : (
        value
      )}
    </div>
  );
}
