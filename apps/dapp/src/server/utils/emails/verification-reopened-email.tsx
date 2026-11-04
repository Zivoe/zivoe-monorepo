import { type AccountType } from '@zivoe/database/onboarding';

import { type DecisionStatus } from '../../verification/verification-status';
import { VerificationEmailShell } from './components/verification-email-shell';

/**
 * The review email for a reopen: the team took a Decision back to look
 * again. After an approval it says what stops meanwhile — linking, and the
 * wallets already linked — so a failing deposit is not the first sign.
 */
export default function VerificationReopenedEmail({
  name,
  verificationUrl,
  accountType,
  previousDecision
}: {
  name?: string;
  verificationUrl: string;
  accountType: AccountType;
  previousDecision: DecisionStatus;
}) {
  const what = accountType === 'organization' ? "your organization's verification" : 'your identity verification';
  const wasApproved = previousDecision === 'approved';

  return (
    <VerificationEmailShell
      preview={`We're taking another look at ${what}.`}
      heading={`We're taking another look at ${what}`}
      name={name}
      paragraphs={[
        `Our team has reopened the review of ${what}.`,
        wasApproved
          ? 'Until the review is complete, you cannot link new wallets, and the wallets you already linked will be removed from the whitelist.'
          : 'There is nothing you need to do right now.',
        'If we need anything from you, we will be in touch. We will email you as soon as a decision is made.'
      ]}
      cta={{ label: 'View your status', href: verificationUrl }}
    />
  );
}
