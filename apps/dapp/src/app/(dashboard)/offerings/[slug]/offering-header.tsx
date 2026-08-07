import { SHARE_CLASS_CATALOG } from '@zivoe/centrifuge-indexer';
import { Link } from '@zivoe/ui/core/link';
import { ArrowLeftIcon } from '@zivoe/ui/icons';

import { type Offering } from '@/offerings';

/**
 * Back link over an identity row — the mock's vault-page header, minus the
 * Standard/Identity/Dashboard switcher and the status pill. The link goes to
 * the homepage, which is the Offerings list this page was reached from.
 */
export default function OfferingHeader({ offering }: { offering: Offering }) {
  return (
    <div className="w-full pt-7">
      {/* -ml-3 cancels the button padding so the label lines up with the identity row below. */}
      <Link href="/" variant="ghost" size="s" className="-ml-3">
        <ArrowLeftIcon />
        Back
      </Link>

      <div className="flex items-center gap-3.5 pt-5.5 pb-1">
        {/* shrink-0 so a wrapping name squeezes its own column, not the logo. */}
        <offering.Logo className="size-11 shrink-0" />

        <div className="flex flex-col gap-0.5">
          <span className="text-small font-medium text-tertiary">
            {SHARE_CLASS_CATALOG[offering.shareClass.key].symbol}
          </span>
          <h1 className="font-heading! text-h6 text-primary lg:text-h5">{offering.name}</h1>
        </div>
      </div>
    </div>
  );
}
