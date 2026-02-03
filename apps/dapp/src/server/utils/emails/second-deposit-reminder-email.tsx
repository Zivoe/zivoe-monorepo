import { Text } from '@react-email/components';

import { ContactCtaSection } from './components/contact-cta-section';
import { EmailLayout } from './components/email-layout';

export default function SecondDepositReminderEmail({
  name,
  accountType
}: {
  name?: string;
  accountType: 'individual' | 'organization';
}) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout preview="Last chance to get started">
      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        One more nudge, then I'll leave you alone.
      </Text>

      {accountType === 'individual' ? (
        <Text className="m-0 mb-4 leading-6 text-neutral-600">
          Private credit has traditionally been reserved for institutional investors. Zivoe is designed to provide
          eligible individuals on-chain access to short-duration private credit strategies, primarily revenue-based
          financing for small and medium-sized businesses.
        </Text>
      ) : (
        <Text className="m-0 mb-4 leading-6 text-neutral-600">
          We're deploying into short-duration private credit, primarily merchant cash advances with 3 to 6 month
          turnover.
        </Text>
      )}

      <Text className="m-0 leading-6 text-neutral-600">
        {accountType === 'individual'
          ? 'If you have any questions about how the protocol works or how to get started, happy to walk through it.'
          : "If you're still evaluating, happy to share access to our data room. Just let me know."}
      </Text>

      <ContactCtaSection ctaText="Go to App" ctaHref="https://app.zivoe.com/" />
    </EmailLayout>
  );
}
