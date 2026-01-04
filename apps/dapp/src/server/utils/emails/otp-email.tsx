import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text
} from '@react-email/components';

import { ZIVOE_LOGO_URL, emailTailwindConfig } from './config';

export default function OTPEmail({ otp }: { otp: string }) {
  return (
    <Html>
      <Head />
      <Preview>Your Zivoe verification code is ready. It expires in 5 minutes.</Preview>
      <Tailwind config={emailTailwindConfig}>
        <Body className="bg-neutral-50 font-sans">
          <Container className="border-neutral-200 bg-neutral-0 mx-auto my-10 max-w-[480px] rounded-xl border px-10 py-10">
            <Section className="mb-8 text-center">
              <Img src={ZIVOE_LOGO_URL} width="112" height="33" alt="Zivoe" className="mx-auto" />
            </Section>

            <Heading className="font-serif text-2xl text-neutral-950 m-0 mb-2 text-center font-semibold">
              Sign in to Zivoe
            </Heading>

            <Text className="m-0 mb-6 text-center leading-6 text-neutral-600">
              Enter this verification code to access your account:
            </Text>

            <Section
              className="border-primary-100 bg-primary-50 my-6 rounded-xl border px-8 py-10"
              style={{ boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' }}
            >
              <Text className="font-mono text-4xl text-primary-600 m-0 text-center font-bold tracking-[0.3em]">
                {otp}
              </Text>
            </Section>

            <Section className="bg-neutral-100 mb-6 rounded-lg px-4 py-3 text-center">
              <Text className="text-sm m-0 text-neutral-600">
                This code expires in <strong className="text-neutral-950">5 minutes</strong>
              </Text>
            </Section>

            <Text className="text-sm text-neutral-500 m-0 mt-4 text-center leading-5">
              If you didn&apos;t request this code, you can safely ignore this email. Someone may have entered your
              email address by mistake.
            </Text>

            <Hr className="border-neutral-200 my-8" />

            <Section className="text-center">
              <Text className="text-xs text-neutral-400 m-0">Zivoe — RWA Credit Protocol</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
