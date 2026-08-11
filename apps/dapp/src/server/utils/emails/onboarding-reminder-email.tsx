import { Link, Text } from '@react-email/components';

import { ContactCtaSection } from './components/contact-cta-section';
import { EmailLayout } from './components/email-layout';

export default function OnboardingReminderEmail({ name, unsubscribeUrl }: { name?: string; unsubscribeUrl?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout
      preview="Finish setting up your account and request early access."
      unsubscribeUrl={unsubscribeUrl}
      showDisclosure
    >
      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        It looks like you started signing up but didn't finish. Zivoe is the private credit layer for stablecoins,
        giving eligible participants a way to put stablecoins to work through loans we make to established lending
        partners.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        We recently completed our move to infrastructure powered by Centrifuge, and early access is now open.{' '}
        <Link href="https://app.zivoe.com/sign-in" className="text-primary-600 underline">
          Complete your onboarding
        </Link>{' '}
        and reply to this email if you'd like to begin the access process. I'll walk you through eligibility and next
        steps.
      </Text>

      <Text className="m-0 leading-6 text-neutral-600">
        If you have any questions or run into a problem, reply here or book time with me below.
      </Text>

      <ContactCtaSection />
    </EmailLayout>
  );
}
