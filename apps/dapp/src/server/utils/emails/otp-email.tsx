import { Heading, Section, Text } from '@react-email/components';

import { EmailLayout } from './components/email-layout';

export default function OTPEmail({ otp }: { otp: string }) {
  return (
    <EmailLayout preview="Your Zivoe verification code is ready. It expires in 5 minutes.">
      <Heading className="font-serif text-2xl m-0 mb-2 text-center font-semibold text-neutral-950">
        Sign in to Zivoe
      </Heading>

      <Text className="m-0 mb-6 text-center leading-6 text-neutral-600">
        Enter this verification code to access your account:
      </Text>

      <Section
        className="my-6 rounded-xl border border-primary-100 bg-primary-50 px-8 py-10"
        style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}
      >
        <Text className="font-mono text-4xl m-0 text-center font-bold tracking-[0.3em] text-primary-600">{otp}</Text>
      </Section>

      <Section className="mb-6 rounded-lg bg-neutral-100 px-4 py-3 text-center">
        <Text className="text-sm m-0 text-neutral-600">
          This code expires in <strong className="text-neutral-950">5 minutes</strong>
        </Text>
      </Section>

      <Text className="text-sm m-0 mt-4 text-center leading-5 text-neutral-500">
        If you didn&apos;t request this code, you can safely ignore this email. Someone may have entered your email
        address by mistake.
      </Text>
    </EmailLayout>
  );
}
