import { type SubjectKind } from '@zivoe/database/organizations';

import { VerificationEmailShell } from './components/verification-email-shell';

export default function VerificationApprovedEmail({
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
        organization ? "Your organization's verification has been approved." : 'Your identity has been verified.'
      }
      heading={organization ? 'Your organization is verified' : "You're verified"}
      name={name}
      paragraphs={[
        organization
          ? "Your organization's verification is complete and has been approved."
          : 'Your identity verification is complete and has been approved.',
        "Before you can deposit, accept the agreements and connect the wallet you will deposit from. We'll show you what's needed next, typically a free signature to request its whitelist. We usually whitelist new addresses within one business day."
      ]}
      cta={{ label: 'Continue', href: verificationUrl }}
    />
  );
}
