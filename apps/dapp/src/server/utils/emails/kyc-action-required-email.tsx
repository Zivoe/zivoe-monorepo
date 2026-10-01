import { KycEmailShell } from './components/kyc-email-shell';

/**
 * The expiry nudge: the investor started verifying, did not finish, and the
 * session has expired — a resume picks it up where they left off. The one
 * action the app ever asks of an investor by email: a failed inquiry is
 * Persona's Workflow to decide, never the investor's to retry.
 */
export default function KycActionRequiredEmail({ name, kycUrl }: { name?: string; kycUrl: string }) {
  return (
    <KycEmailShell
      preview="Pick up your identity verification where you left off."
      heading="Finish your verification"
      name={name}
      paragraphs={[
        'You started verifying your identity but did not finish, and the session has expired.',
        'You can pick it up again where you left off.'
      ]}
      cta={{ label: 'Continue verification', href: kycUrl }}
    />
  );
}
