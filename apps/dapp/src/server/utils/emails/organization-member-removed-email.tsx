import { Heading, Link, Text } from '@react-email/components';

import { EmailLayout, WRAP } from './components/email-layout';

/**
 * Sent to someone another member took out of an organization. There are no roles, so any member can
 * remove any other: this email is how a removal they did not expect gets noticed. Names come from
 * people, so they are never styled as a link.
 */
export default function OrganizationMemberRemovedEmail({
  name,
  organizationName,
  removedByName,
  supportEmail
}: {
  name: string | null;
  organizationName: string;
  removedByName: string;
  supportEmail: string;
}) {
  return (
    <EmailLayout preview={`${removedByName} removed you from ${organizationName} on Zivoe.`}>
      <Heading className="font-serif text-2xl m-0 mb-6 text-center font-semibold text-neutral-950" style={WRAP}>
        You were removed from {organizationName}
      </Heading>

      <Text className="m-0 mb-4 leading-6 text-neutral-600" style={WRAP}>
        {name ? `Hi ${name}, ` : ''}
        {removedByName} removed you from {organizationName} on Zivoe. You no longer have access to it. Invitations you
        sent for it that were still waiting have been canceled.
      </Text>

      <Text className="text-sm m-0 leading-5 text-neutral-500">
        Didn&apos;t expect this? Contact us at{' '}
        <Link href={`mailto:${supportEmail}`} className="text-neutral-500 underline">
          {supportEmail}
        </Link>
        .
      </Text>
    </EmailLayout>
  );
}
