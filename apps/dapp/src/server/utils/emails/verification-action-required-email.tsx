import { type AccountType } from '@zivoe/database/onboarding';

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
