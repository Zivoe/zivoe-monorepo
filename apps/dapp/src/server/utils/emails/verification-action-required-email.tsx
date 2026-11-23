import { type SubjectKind } from '@zivoe/database/organizations';

import { VerificationEmailShell } from './components/verification-email-shell';

/**
 * The expiry nudge: the investor started verifying, did not finish, and the
 * session has expired — a resume picks it up where they left off. The one
 * action the app ever asks of an investor by email: a failed inquiry is
 * Persona's Workflow to decide, never the investor's to retry.
 */
export default function VerificationActionRequiredEmail({
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
          ? "Pick up your organization's verification where you left off."
          : 'Pick up your identity verification where you left off.'
      }
      heading={organization ? "Finish your organization's verification" : 'Finish your verification'}
      name={name}
      paragraphs={[
        organization
          ? 'You started verifying your organization but did not finish, and the session has expired.'
          : 'You started verifying your identity but did not finish, and the session has expired.',
        'You can pick it up again where you left off.'
      ]}
      cta={{ label: 'Continue verification', href: verificationUrl }}
    />
  );
}
