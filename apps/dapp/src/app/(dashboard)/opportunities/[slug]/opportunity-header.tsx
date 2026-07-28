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
        <ol className="text-small flex items-center gap-2">
          <li>
            <NextLink href="/" className="text-secondary hover:text-primary transition-colors">
              Opportunities
            </NextLink>
          </li>

          <li aria-hidden className="text-tertiary">
            /
          </li>

          <li className="text-primary font-medium" aria-current="page">
            {opportunity.name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-5.5 pb-1">
        <opportunity.Logo className="size-11" />
        <h1 className="font-heading! text-h6 text-primary lg:text-h5">{opportunity.name}</h1>
        <span className="text-smallSubheading text-tertiary font-medium">{opportunity.shareClass.symbol}</span>
      </div>
    </div>
  );
}
