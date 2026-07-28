import { NextLink } from '@zivoe/ui/core/link';

import { type Offering } from '@/offerings';

/**
 * Breadcrumb over an identity row — the mock's vault-page header, minus the
 * Standard/Identity/Dashboard switcher and the status pill.
 */
export default function OfferingHeader({ offering }: { offering: Offering }) {
  return (
    <div className="w-full pt-7">
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-small">
          <li>
            <NextLink href="/" className="text-secondary transition-colors hover:text-primary">
              Offerings
            </NextLink>
          </li>

          <li aria-hidden className="text-tertiary">
            /
          </li>

          <li className="font-medium text-primary" aria-current="page">
            {offering.name}
          </li>
        </ol>
      </nav>

      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 pt-5.5 pb-1">
        <offering.Logo className="size-11" />
        <h1 className="font-heading! text-h6 text-primary lg:text-h5">{offering.name}</h1>
        <span className="text-smallSubheading font-medium text-tertiary">{offering.shareClass.symbol}</span>
      </div>
    </div>
  );
}
