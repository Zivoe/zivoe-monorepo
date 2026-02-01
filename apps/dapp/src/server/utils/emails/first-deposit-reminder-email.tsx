import { Text } from '@react-email/components';

import { ContactCtaSection } from './components/contact-cta-section';
import { EmailLayout } from './components/email-layout';

export default function FirstDepositReminderEmail({
  name,
  accountType
}: {
  name?: string;
  accountType: 'individual' | 'organization';
}) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout preview="Ready to earn yield on private credit?">
      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      {accountType === 'individual' ? (
        <Text className="m-0 mb-4 leading-6 text-neutral-600">
          Just wanted to follow up and say thanks for signing up. As a refresher, Zivoe provides on-chain access to
          private credit strategies backed by real business cash flows.
        </Text>
      ) : (
        <Text className="m-0 mb-4 leading-6 text-neutral-600">
          Just wanted to follow up and say thanks for signing up. As a refresher, Zivoe provides on-chain access to
          private credit strategies backed by real business cash flows.
        </Text>
      )}

      <Text className="m-0 leading-6 text-neutral-600">
        {accountType === 'individual'
          ? 'If you have any questions or want a walkthrough of how Zivoe works, happy to help.'
          : 'If you have any questions or want to walk through the structure, happy to help.'}
      </Text>

      <ContactCtaSection ctaText="Go to App" ctaHref="https://app.zivoe.com/" />
    </EmailLayout>
  );
}
