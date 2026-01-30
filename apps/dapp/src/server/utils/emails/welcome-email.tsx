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
        I'm Thor from Zivoe's onboarding team, nice to meet you. I look after new liquidity providers and partners
        joining the platform.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        I saw your account creation come through and wanted to check in to see if there are any immediate questions I
        can help answer.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        Our primary offering is zVLT, a yield-bearing token targeting ~15% net annualized returns. The strategy deploys
        capital across short-duration private credit verticals, primarily revenue-based financing for small and
        medium-sized businesses, offering faster performance visibility than traditional private credit opportunities.
      </Text>

      <Text className="m-0 leading-6 text-neutral-600">Worth a quick chat?</Text>

      <ContactCtaSection />
    </EmailLayout>
  );
}
