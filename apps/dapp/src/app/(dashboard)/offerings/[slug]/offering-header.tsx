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

      <div className="flex items-center gap-3.5 pt-5.5 pb-1">
        {/* shrink-0 so a wrapping name squeezes its own column, not the logo. */}
        <offering.Logo className="size-11 shrink-0" />

        <div className="flex flex-col gap-0.5">
          <span className="text-small font-medium text-tertiary">{offering.shareClass.symbol}</span>
          <h1 className="font-heading! text-h6 text-primary lg:text-h5">{offering.name}</h1>
        </div>
      </div>
    </div>
  );
}
