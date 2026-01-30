import { Heading, Text } from '@react-email/components';

import { BookCallSection } from './components/book-call-section';
import { EmailLayout } from './components/email-layout';

export default function FirstOnboardingReminderEmail({
  name,
  accountType
}: {
  name?: string;
  accountType: 'individual' | 'organization';
}) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout>
      <Heading className="font-serif text-2xl text-neutral-950 m-0 mb-6 text-center font-semibold">
        Getting Started
      </Heading>

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

      <BookCallSection ctaText="Go to App" ctaHref="https://app.zivoe.com/" />
    </EmailLayout>
  );
}
