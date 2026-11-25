import { type SubjectKind } from '@zivoe/database/organizations';

import { VerificationEmailShell } from './components/verification-email-shell';

/**
 * The review email. For an organization the review also waits on the people
 * it listed: Persona emails each owner and control person their own
 * verification, so the organization hears that here and does not wonder
 * why the review takes longer than a person's.
 */
export default function VerificationUnderReviewEmail({
  name,
  verificationUrl,
  subjectKind,
  organizationName,
  caseWaitingOn = null
}: {
  name?: string;
  verificationUrl: string;
  subjectKind: SubjectKind;
  organizationName?: string | null;
  /** For an organization: whether its KYB case waits on the people it listed, or on the team. */
  caseWaitingOn?: 'people' | 'team' | null;
}) {
  const organization = subjectKind === 'organization';
  const paragraphs = organization
    ? [
        "Thanks for completing your organization's verification.",
        caseWaitingOn === 'people'
          ? 'Each owner and control person you listed has received an email from Persona asking them to verify their identity, and has seven days to do so. Our review completes once they have.'
          : 'A member of our team is reviewing it now.',
        'There is nothing more you need to do. We will email you as soon as a decision is made.'
      ]
    : [
        'Thanks for completing your identity verification. A member of our team is reviewing it now.',
        'There is nothing more you need to do. We will email you as soon as a decision is made.'
      ];

  return (
    <VerificationEmailShell
      organizationName={organizationName}
      preview={
        organization
          ? "Your organization's verification is being reviewed."
          : 'Your identity verification is being reviewed.'
      }
      heading={organization ? "Your organization's verification is under review" : 'Your verification is under review'}
      name={name}
      paragraphs={paragraphs}
      cta={{ label: 'View your status', href: verificationUrl }}
      footnote={organization ? undefined : 'Reviews usually complete within a few business days.'}
    />
  );
}
