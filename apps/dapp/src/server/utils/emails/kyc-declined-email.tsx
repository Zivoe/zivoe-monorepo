import { EMAILS } from '@/lib/emails';

import { KycEmailShell } from './components/kyc-email-shell';

export default function KycDeclinedEmail({ name, kycUrl }: { name?: string; kycUrl: string }) {
  return (
    <KycEmailShell
      preview="An update on your identity verification."
      heading="We couldn't verify your identity"
      name={name}
      paragraphs={[
        'After reviewing your verification, we are unable to approve it at this time.',
        `If you believe this is a mistake or would like to discuss it, reply to this email or write to ${EMAILS.INQUIRE} and the Zivoe team will help.`
      ]}
      cta={{ label: 'View your status', href: kycUrl }}
    />
  );
}
