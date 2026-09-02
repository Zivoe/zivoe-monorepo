import { Heading, Text } from '@react-email/components';

import { ContactCtaSection } from './components/contact-cta-section';
import { EmailLayout } from './components/email-layout';

export default function WelcomeEmail({ name, unsubscribeUrl }: { name?: string; unsubscribeUrl?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout
      preview="Learn how Zivoe works and how to request early access."
      unsubscribeUrl={unsubscribeUrl}
      disclosure="general"
    >
      <Heading className="font-serif text-2xl m-0 mb-6 text-center font-semibold text-neutral-950">
        Welcome to Zivoe
      </Heading>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        I'm Thor, and I help new users get set up at Zivoe. I saw your account come through and wanted to introduce
        myself.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        Zivoe is the private credit layer for stablecoins. We finance lending partners that originate and service loans
        in their markets. Returns are based on the performance of those loans.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        We recently completed our move to infrastructure powered by Centrifuge. Eligible participants can now request
        early access to deposit. If you'd like to begin the access process, reply to this email and I'll walk you
        through the next steps.
      </Text>

      <Text className="m-0 leading-6 text-neutral-600">
        I'm happy to answer any questions. Reply here or book time with me below.
      </Text>

      <ContactCtaSection />
    </EmailLayout>
  );
}
