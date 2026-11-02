import { type AccountType } from '@zivoe/database/onboarding';

import { VerificationEmailShell } from './components/verification-email-shell';

export default function VerificationApprovedEmail({
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
        organization ? "Your organization's verification has been approved." : 'Your identity has been verified.'
      }
      heading={organization ? 'Your organization is verified' : "You're verified"}
      name={name}
      paragraphs={[
        organization
          ? "Your organization's verification is complete and has been approved."
          : 'Your identity verification is complete and has been approved.',
        'One step remains before you can deposit: connect the wallet you will invest from and sign a free message to request its whitelist. We usually whitelist new addresses within one business day.'
      ]}
      cta={{ label: 'Connect your wallet', href: verificationUrl }}
    />
  );
}
