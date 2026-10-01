import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Link } from '@zivoe/ui/core/link';

import { EMAILS } from '@/lib/utils';

import { type InvestorRestriction } from '@/centrifuge';

import { useIsKycEnabled } from '../../kyc-flag-provider';

// What a flow shows when the Centrifuge vault will not admit the wallet: the
// action and, beneath it, why. Shared by both flows so the routes out cannot
// drift between them.
//
// Two answers, deliberately. Freeze is the one case with a genuinely
// different route out — access was taken away rather than never granted, so
// the ask is to have the suspension reviewed, and the action stays a dead
// end. Every other restriction (not a member, membership expired, an absent
// or unexplained one) is "not whitelisted yet": whitelisting follows identity
// verification, so the action leads to `/verification`, which knows the
// investor's exact status and next step whoever they are.
//
// Behind the `kyc` flag: while it is off, "not whitelisted" stays the pre-KYC
// dead end — a disabled action, a locked form and "contact us".

const isWalletFrozen = (restriction: InvestorRestriction | undefined) => restriction === 'frozen';

/** Whether a not-admitted wallet also locks the form: a frozen one always does; any other may still size an amount. */
export function useNotAdmittedLocksForm(restriction: InvestorRestriction | undefined): boolean {
  return !useIsKycEnabled() || isWalletFrozen(restriction);
}

export function WalletAccessAction({ restriction }: { restriction: InvestorRestriction | undefined }) {
  const isKycEnabled = useIsKycEnabled();

  if (isWalletFrozen(restriction) || !isKycEnabled)
    return (
      <Button fullWidth isDisabled>
        {isWalletFrozen(restriction) ? 'Wallet Frozen' : 'Wallet Not Whitelisted'}
      </Button>
    );

  return (
    <Link fullWidth variant="primary" href="/verification">
      Get whitelisted
    </Link>
  );
}

export function WalletAccessCallout({ restriction }: { restriction: InvestorRestriction | undefined }) {
  const isKycEnabled = useIsKycEnabled();

  if (isWalletFrozen(restriction))
    return (
      <Callout variant="warning">
        This wallet is frozen on this chain and cannot transact in this vault. Contact us at <ContactLink /> if you
        believe this is a mistake.
      </Callout>
    );

  if (!isKycEnabled)
    return (
      <Callout variant="warning">
        You must be whitelisted to interact with this vault. Contact us at <ContactLink /> to request access.
      </Callout>
    );

  return (
    <Callout variant="warning">
      You must be whitelisted to interact with this vault. Whitelisting follows identity verification; if you are
      already verified, contact us at <ContactLink />.
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
