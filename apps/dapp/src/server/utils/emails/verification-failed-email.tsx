import { type AccountType } from '@zivoe/database/onboarding';

import { EMAILS } from '@/lib/emails';

import { VerificationEmailShell } from './components/verification-email-shell';

/**
 * The end of the road for an organization: no Workflow decides a failed
 * business inquiry, so the team takes it from here. Never sent to an
 * individual, whose failure a Workflow decides seconds later.
 */
export default function VerificationFailedEmail({
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
        organization
          ? "Your organization's verification could not be completed."
          : 'Your verification could not be completed.'
      }
      heading={
        organization
          ? "We couldn't complete your organization's verification"
          : "We couldn't complete your verification"
      }
      name={name}
      paragraphs={[
        organization
          ? "Your organization's verification could not be completed."
          : 'Your verification could not be completed.',
        `Reply to this email or write to ${EMAILS.INQUIRE} and the Zivoe team will tell you what happens next.`
      ]}
      cta={{ label: 'View your status', href: verificationUrl }}
    />
  );
}
