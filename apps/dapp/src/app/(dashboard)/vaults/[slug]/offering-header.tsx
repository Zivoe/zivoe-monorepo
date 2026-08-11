import { Link } from '@zivoe/ui/core/link';
import { ArrowLeftIcon } from '@zivoe/ui/icons';

import OfferingIdentity, { OfferingStatusBadge } from '@/components/offering-identity';

import { type Offering } from '@/offerings';

/**
 * Back link over an identity row — the mock's Offering-page header, minus the
 * Standard/Identity/Dashboard switcher. The link goes to the homepage, which
 * is the Offerings list this page was reached from.
 */
export default function OfferingHeader({ offering }: { offering: Offering }) {
  return (
    <div className="w-full pt-7">
      {/* -ml-3 cancels the button padding so the label lines up with the identity row below. */}
      <Link href="/" variant="ghost" size="s" className="-ml-3">
        <ArrowLeftIcon />
        Back
      </Link>

      <div className="pt-5.5 pb-1">
        <OfferingIdentity
          offering={offering}
          as="h1"
          size="lg"
          trailing={<OfferingStatusBadge status={offering.status} />}
        />
      </div>
    </div>
  );
}
