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

import { emailTailwindConfig, ZIVOE_LOGO_URL } from './config';

export default function WelcomeEmail({ name }: { name?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <Html>
      <Head />
      <Preview>Your journey into decentralized credit starts now.</Preview>
      <Tailwind config={emailTailwindConfig}>
        <Body className="bg-neutral-50 font-sans">
          <Container className="border-neutral-200 bg-neutral-0 mx-auto my-10 max-w-[480px] rounded-xl border px-10 py-10">
            <Section className="mb-8 text-center">
              <Img src={ZIVOE_LOGO_URL} width="112" height="33" alt="Zivoe" className="mx-auto" />
            </Section>

            <Heading className="font-serif text-2xl text-neutral-950 m-0 mb-2 text-center font-semibold">
              Welcome to Zivoe
            </Heading>

            <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

            <Text className="m-0 mb-4 leading-6 text-neutral-600">
              Thank you for joining Zivoe. We&apos;re excited to have you on board.
            </Text>

            <Text className="m-0 mb-6 leading-6 text-neutral-600">
              Zivoe is a decentralized credit protocol that brings real-world assets on-chain. Start exploring the
              platform to discover yield opportunities and learn more about our mission.
            </Text>

            <Text className="text-sm text-neutral-500 m-0 mt-4 text-center leading-5">
              If you have any questions, feel free to reach out to our support team.
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
