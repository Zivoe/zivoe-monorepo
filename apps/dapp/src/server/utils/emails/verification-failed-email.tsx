import { type SubjectKind } from '@zivoe/database/organizations';

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
  subjectKind,
  organizationName
}: {
  name?: string;
  verificationUrl: string;
  subjectKind: SubjectKind;
  organizationName?: string | null;
}) {
  const organization = subjectKind === 'organization';

  return (
    <VerificationEmailShell
      organizationName={organizationName}
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
