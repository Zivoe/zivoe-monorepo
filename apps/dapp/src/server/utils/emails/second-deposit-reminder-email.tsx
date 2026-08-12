import { Text } from '@react-email/components';

import { ContactCtaSection } from './components/contact-cta-section';
import { EmailLayout } from './components/email-layout';

export default function SecondDepositReminderEmail({
  name,
  accountType,
  unsubscribeUrl
}: {
  name?: string;
  accountType: 'individual' | 'organization';
  unsubscribeUrl?: string;
}) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <EmailLayout preview="One final follow-up on early access." unsubscribeUrl={unsubscribeUrl} showDisclosure>
      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">One final follow-up from me.</Text>

      {accountType === 'individual' ? (
        <>
          <Text className="m-0 mb-4 leading-6 text-neutral-600">
            Zivoe connects stablecoin capital with private credit through loans we make to established lending partners.
          </Text>

          <Text className="m-0 leading-6 text-neutral-600">
            If you'd like to begin the access process, reply to this email and I'll follow up with next steps. You can
            also book time with me below.
          </Text>
        </>
      ) : (
        <>
          <Text className="m-0 mb-4 leading-6 text-neutral-600">
            Zivoe uses institutional and stablecoin capital to finance established lending partners in their markets.
          </Text>

          <Text className="m-0 leading-6 text-neutral-600">
            If your organization is still evaluating Zivoe, I'm happy to share diligence materials or walk through the
            structure. Reply here to begin the access process, or book time with me below.
          </Text>
        </>
      )}

      <ContactCtaSection />
    </EmailLayout>
  );
}
