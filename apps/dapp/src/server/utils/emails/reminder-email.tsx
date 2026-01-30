import { Heading, Text } from '@react-email/components';

import { BookCallSection } from './components/book-call-section';
import { EmailLayout } from './components/email-layout';

export default function ReminderEmail({ name }: { name?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout preview="Quick follow-up from Zivoe">
      <Heading className="font-serif text-2xl text-neutral-950 m-0 mb-6 text-center font-semibold">
        Quick Follow-Up
      </Heading>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        Thor here again from Zivoe. I wanted to follow up on my previous email and see if you had any questions
        about getting started.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        Many of our liquidity providers find it helpful to have a quick intro call where we can walk through zVLT,
        our yield-bearing token targeting ~15% net annualized returns, and answer any questions about the
        platform.
      </Text>

      <Text className="m-0 leading-6 text-neutral-600">
        If you're interested, I'd be happy to find a time that works for you.
      </Text>

      <BookCallSection />
    </EmailLayout>
  );
}
