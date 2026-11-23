import { Heading, Link, Section, Text } from '@react-email/components';

import { EmailLayout, WRAP } from './components/email-layout';

const EXPIRY_DATE = new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' });

/**
 * An invitation names who asked and for what, says how it ends, and warns about
 * the one thing someone misusing it would try.
 * Names come from people, so they are never styled as a link: React escapes them,
 * and the organization name was checked for URLs when it was written.
 */
export default function OrganizationInvitationEmail({
  organizationName,
  inviterName,
  inviterEmail,
  expiresAt,
  invitationUrl
}: {
  organizationName: string;
  inviterName: string;
  inviterEmail: string | null;
  expiresAt: Date;
  invitationUrl: string;
}) {
  const inviter = inviterEmail ? `${inviterName} (${inviterEmail})` : inviterName;

  return (
    <EmailLayout preview={`${inviterName} invited you to join ${organizationName} on Zivoe.`}>
      <Heading className="font-serif text-2xl m-0 mb-6 text-center font-semibold text-neutral-950" style={WRAP}>
        Join {organizationName} on Zivoe
      </Heading>

      <Text className="m-0 mb-4 leading-6 text-neutral-600" style={WRAP}>
        {inviter} invited you to join {organizationName} on Zivoe. As a member you can manage the organization&apos;s
        account and track its portfolio together.
      </Text>

      <Text className="m-0 mb-4 leading-6 text-neutral-600">
        Sign in with this email address to accept. Nothing changes until you do, and the invitation ends on{' '}
        {EXPIRY_DATE.format(expiresAt)}.
      </Text>

      <Section className="my-8 text-center">
        {/* Left out of the plain-text part, which keeps the link written out below instead. */}
        <Link
          href={invitationUrl}
          data-skip-in-text="true"
          className="text-white rounded-lg bg-neutral-950 px-6 py-3 text-center font-medium no-underline"
        >
          View invitation
        </Link>
      </Section>

      <Text className="text-sm m-0 mb-4 leading-5 break-all text-neutral-500">
        Or open this link:{' '}
        <Link href={invitationUrl} className="text-neutral-500 underline">
          {invitationUrl}
        </Link>
      </Text>

      <Text className="text-sm m-0 mb-4 leading-5 text-neutral-500">
        Not expecting this? You can ignore this email: the invitation ends on its own.
      </Text>

      <Text className="text-sm m-0 leading-5 text-neutral-500">
        Zivoe will never ask for your seed phrase or for funds in an invitation.
      </Text>
    </EmailLayout>
  );
}
