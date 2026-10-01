import { KycEmailShell } from './components/kyc-email-shell';

export default function KycApprovedEmail({ name, kycUrl }: { name?: string; kycUrl: string }) {
  return (
    <KycEmailShell
      preview="Your identity has been verified."
      heading="You're verified"
      name={name}
      paragraphs={[
        'Your identity verification is complete and has been approved.',
        'You can review your verification status at any time from your account.'
      ]}
      cta={{ label: 'View your status', href: kycUrl }}
    />
  );
}
