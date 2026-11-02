import { type AccountType } from '@zivoe/database/onboarding';

import { EMAILS } from '@/lib/emails';

import { VerificationEmailShell } from './components/verification-email-shell';

export default function VerificationDeclinedEmail({
  name,
  verificationUrl,
  accountType
}: {
  name?: string;
  verificationUrl: string;
  accountType: AccountType;
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
        `If you believe this is a mistake or would like to discuss it, reply to this email or write to ${EMAILS.INQUIRE} and the Zivoe team will help.`
      ]}
      cta={{ label: 'View your status', href: verificationUrl }}
    />
  );
}
