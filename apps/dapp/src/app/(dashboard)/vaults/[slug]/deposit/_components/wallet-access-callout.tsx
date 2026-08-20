import { Callout } from '@zivoe/ui/core/callout';

import { EMAILS } from '@/lib/utils';

import { type InvestorRestriction } from '@/centrifuge';

/**
 * Why a flow's action is disabled when the Centrifuge vault will not admit the
 * wallet. Shared by both flows so the routes out cannot drift between them.
 *
 * One branch, deliberately: three of the four blocked restrictions say the
 * same thing, and a per-restriction lookup would invite copy that diverges by
 * accident. Freeze is the one case with a genuinely different route out —
 * access was taken away rather than never granted, so the ask is to have the
 * suspension reviewed, not to request access. An absent or unexplained
 * restriction falls to the general copy, which is true of every blocked case.
 */
export function WalletAccessCallout({ restriction }: { restriction: InvestorRestriction | undefined }) {
  if (restriction === 'frozen')
    return (
      <Callout variant="warning">
        This wallet is frozen on this chain and cannot transact in this vault. Contact us at <ContactLink /> if you
        believe this is a mistake.
      </Callout>
    );

  return (
    <Callout variant="warning">
      You must be whitelisted to interact with this vault. Contact us at <ContactLink /> to request access.
    </Callout>
  );
}

function ContactLink() {
  return (
    <a href={`mailto:${EMAILS.INQUIRE}`} className="underline underline-offset-4 hover:no-underline">
      {EMAILS.INQUIRE}
    </a>
  );
}
