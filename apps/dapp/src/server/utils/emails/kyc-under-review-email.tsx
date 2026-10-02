import { KycEmailShell } from './components/kyc-email-shell';

export default function KycUnderReviewEmail({ name, kycUrl }: { name?: string; kycUrl: string }) {
  return (
    <KycEmailShell
      preview="Your identity verification is being reviewed."
      heading="Your verification is under review"
      name={name}
      paragraphs={[
        'Thanks for completing your identity verification. A member of our team is reviewing it now.',
        'There is nothing more you need to do. We will email you as soon as a decision is made.'
      ]}
      cta={{ label: 'View your status', href: kycUrl }}
      footnote="Reviews usually complete within a few business days."
    />
  );
}
