import { type AccountType } from '@zivoe/database/onboarding';

import { EMAILS } from '@/lib/emails';

import { type DecisionStatus } from '../../verification/verification-status';
import { VerificationEmailShell } from './components/verification-email-shell';

/**
 * The decline email. After an approval a reviewer reversed, it also says what
 * stops — linking, and the wallets already linked — so a failing deposit is
 * not the first sign.
 */
export default function VerificationDeclinedEmail({
  name,
  verificationUrl,
  accountType,
  previousDecision
}: {
  name?: string;
  verificationUrl: string;
  accountType: AccountType;
  previousDecision?: DecisionStatus;
}) {
  const organization = accountType === 'organization';

  return (
    <VerificationEmailShell
      preview={
        organization ? "An update on your organization's verification." : 'An update on your identity verification.'
      }
      heading={organization ? "We couldn't verify your organization" : "We couldn't verify your identity"}
      name={name}
      paragraphs={[
        organization
          ? "After reviewing your organization's verification, we are unable to approve it at this time."
          : 'After reviewing your verification, we are unable to approve it at this time.',
        ...(previousDecision === 'approved'
          ? [
              'Your earlier approval no longer stands: you cannot link new wallets, and the wallets you already linked will be removed from the whitelist.'
            ]
          : []),
        `If you believe this is a mistake or would like to discuss it, reply to this email or write to ${EMAILS.INQUIRE} and the Zivoe team will help.`
      ]}
      cta={{ label: 'View your status', href: verificationUrl }}
    />
  );
}
