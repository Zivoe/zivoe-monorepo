import { Heading, Text } from '@react-email/components';

import { ContactCtaSection } from './components/contact-cta-section';
import { EmailLayout } from './components/email-layout';

export default function WelcomeEmail({ name }: { name?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout preview="Let's connect">
      <Heading className="font-serif text-2xl text-neutral-950 m-0 mb-6 text-center font-semibold">
        Welcome to Zivoe
      </Heading>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        I'm Thor from Zivoe's onboarding team, nice to meet you. I help support new users joining the platform.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        I saw your account creation come through and wanted to check in to see if you have any immediate questions I
        can help answer.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        zVLT is a return-generating token providing on-chain access to short-duration private credit strategies,
        primarily revenue-based financing for small and medium-sized businesses.
      </Text>

      <Text className="m-0 leading-6 text-neutral-600">Worth a quick chat?</Text>

      <ContactCtaSection />
    </EmailLayout>
  );
}
