import { Text } from '@react-email/components';

import { ContactCtaSection } from './components/contact-cta-section';
import { EmailLayout } from './components/email-layout';

export default function OnboardingReminderEmail({ name }: { name?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout preview="Finish your onboarding">
      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        Looks like you started signing up but didn't finish. We're offering something different - institutional-grade
        private credit returns, accessible on-chain to qualified individuals.
      </Text>

      <Text className="m-0 leading-6 text-neutral-600">
        If you hit any snags or have questions, happy to help get you set up.
      </Text>

      <ContactCtaSection ctaText="Finish Onboarding" ctaHref="https://app.zivoe.com/onboarding" />
    </EmailLayout>
  );
}
