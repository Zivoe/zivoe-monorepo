import { NextLink } from '@zivoe/ui/core/link';

import { type Opportunity } from '@/opportunities';

/**
 * Breadcrumb over an identity row — the mock's vault-page header, minus the
 * Standard/Identity/Dashboard switcher and the status pill.
 */
export default function OpportunityHeader({ opportunity }: { opportunity: Opportunity }) {
  return (
    <div className="w-full pt-7">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-small">
          <li>
            <NextLink href="/" className="text-secondary transition-colors hover:text-primary">
              Opportunities
            </NextLink>
          </li>

          <li aria-hidden className="text-tertiary">
            /
          </li>

          <li className="font-medium text-primary" aria-current="page">
            {opportunity.name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-5.5 pb-1">
        <opportunity.Logo className="size-11" />
        <h1 className="font-heading! text-h6 text-primary lg:text-h5">{opportunity.name}</h1>
        <span className="text-smallSubheading font-medium text-tertiary">{opportunity.shareClass.symbol}</span>
      </div>
    </div>
  );
}
