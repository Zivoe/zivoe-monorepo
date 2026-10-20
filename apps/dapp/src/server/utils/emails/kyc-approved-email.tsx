import { KycEmailShell } from './components/kyc-email-shell';

export default function KycApprovedEmail({ name, kycUrl }: { name?: string; kycUrl: string }) {
  return (
    <KycEmailShell
      preview="Your identity has been verified."
      heading="You're verified"
      name={name}
      paragraphs={[
        'Your identity verification is complete and has been approved.',
        'One step remains before you can deposit: connect the wallet you will invest from and sign a free message to request its whitelist. We usually whitelist new addresses within one business day.'
      ]}
      cta={{ label: 'Connect your wallet', href: kycUrl }}
    />
  );
}
