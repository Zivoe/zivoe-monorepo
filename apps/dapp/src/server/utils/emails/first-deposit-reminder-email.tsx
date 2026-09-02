import { Text } from '@react-email/components';

import { ContactCtaSection } from './components/contact-cta-section';
import { EmailLayout } from './components/email-layout';

export default function FirstDepositReminderEmail({
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
    <EmailLayout
      preview="Reply to request early access or book time with me."
      unsubscribeUrl={unsubscribeUrl}
      disclosure="general"
    >
      <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

      {accountType === 'individual' ? (
        <>
          <Text className="m-0 mb-4 leading-6 text-neutral-600">
            Thanks again for signing up. As a refresher, Zivoe is the private credit layer for stablecoins. Returns are
            based on the performance of the loans we make to our lending partners.
          </Text>

          <Text className="m-0 mb-4 leading-6 text-neutral-600">
            Early access is open to eligible participants. Reply to this email if you'd like to begin the access
            process, and I'll follow up with next steps.
          </Text>

          <Text className="m-0 leading-6 text-neutral-600">
            If you'd rather talk it through first, book time with me below.
          </Text>
        </>
      ) : (
        <>
          <Text className="m-0 mb-4 leading-6 text-neutral-600">
            Thanks again for signing up. Zivoe is the private credit layer for stablecoins. We use institutional and
            stablecoin capital to finance established lending partners in their markets.
          </Text>

          <Text className="m-0 mb-4 leading-6 text-neutral-600">
            Early access is open to eligible participants. Reply to this email if your organization would like to begin
            the access process, and I'll follow up with next steps.
          </Text>

          <Text className="m-0 leading-6 text-neutral-600">
            I'm happy to walk through the structure or share diligence materials. Book time below or reply here.
          </Text>
        </>
      )}

      <ContactCtaSection />
    </EmailLayout>
  );
}
