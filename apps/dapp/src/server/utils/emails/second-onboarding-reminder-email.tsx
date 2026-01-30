import { Heading, Text } from '@react-email/components';

import { BookCallSection } from './components/book-call-section';
import { EmailLayout } from './components/email-layout';

export default function SecondOnboardingReminderEmail({
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
        Last Nudge
      </Heading>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        One more nudge, then I'll leave you alone.
      </Text>

      {accountType === 'individual' ? (
        <Text className="m-0 mb-4 leading-6 text-neutral-600">
          Private credit has been one of the top performing asset classes of the last decade but has been inaccessible
          to most. Zivoe makes this asset class accessible on-chain to qualified participants.
        </Text>
      ) : (
        <Text className="m-0 mb-4 leading-6 text-neutral-600">
          We're deploying into short-duration private credit - primarily merchant cash advances with 3-6 month
          turnover.
        </Text>
      )}

      <Text className="m-0 leading-6 text-neutral-600">
        {accountType === 'individual'
          ? 'If you have any questions about how the protocol works or how to get started, happy to walk through it.'
          : "If you're still evaluating, happy to share access to our data room. Just let me know."}
      </Text>

      <BookCallSection ctaText="Go to App" ctaHref="https://app.zivoe.com/" />
    </EmailLayout>
  );
}
