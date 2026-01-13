import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Tailwind,
  Text
} from '@react-email/components';

import { BASE_URL } from '../base-url';
import { THOR_AVATAR_URL, ZIVOE_LOGO_URL, emailTailwindConfig } from './config';

export default function WelcomeEmail({ name }: { name?: string }) {
  const greeting = name ? `Hi ${name},` : 'Hi there,';

  return (
    <Html>
      <Head />
      <Preview>Let's connect</Preview>
      <Tailwind config={emailTailwindConfig}>
        <Body className="bg-neutral-50 font-sans">
          <Container className="border-neutral-200 bg-neutral-0 mx-auto my-10 max-w-[480px] rounded-xl border px-10 py-10">
            <Section className="mb-8 text-center">
              <Img src={ZIVOE_LOGO_URL} width="112" height="33" alt="Zivoe" className="mx-auto" />
            </Section>

            <Heading className="font-serif text-2xl text-neutral-950 m-0 mb-6 text-center font-semibold">
              Welcome to Zivoe
            </Heading>

            <Text className="m-0 mb-4 leading-6 text-neutral-600">{greeting}</Text>

            <Text className="m-0 mb-4 leading-6 text-neutral-600">
              I'm Thor from Zivoe's onboarding team, nice to meet you. I look after new liquidity providers and partners
              joining the platform.
            </Text>

            <Text className="m-0 mb-4 leading-6 text-neutral-600">
              I saw your account creation come through and wanted to check in to see if there are any immediate
              questions I can help answer.
            </Text>

            <Text className="m-0 mb-4 leading-6 text-neutral-600">
              Our primary offering is zVLT, a yield-bearing token targeting ~15% net annualized returns. The strategy
              deploys capital across short-duration private credit verticals, primarily revenue-based financing for
              small and medium-sized businesses, offering faster performance visibility than traditional private credit
              opportunities.
            </Text>

            <Text className="m-0 leading-6 text-neutral-600">Worth a quick chat?</Text>

            <Section className="my-8 text-center">
              <Link
                href={`${BASE_URL}/meet/thor`}
                className="text-neutral-0 rounded-lg bg-primary-600 px-6 py-3 font-medium"
                style={{ display: 'inline-block' }}
              >
                Book a Call
              </Link>
              <Text className="text-sm text-neutral-500 m-0 mt-3">
                Or reach out on Telegram{' '}
                <Link href={`${BASE_URL}/telegram/thor`} className="text-primary-600 underline">
                  @thorabbasi
                </Link>
              </Text>
            </Section>

            <Section className="mt-6">
              <table>
                <tr>
                  <td style={{ verticalAlign: 'top', paddingRight: '12px' }}>
                    <Img src={THOR_AVATAR_URL} width="48" height="48" alt="Thor" style={{ borderRadius: '50%' }} />
                  </td>

                  <td>
                    <Text className="text-neutral-950 m-0 font-medium">Thor</Text>
                    <Text className="text-sm text-neutral-500 m-0">Onboarding, Zivoe</Text>
                  </td>
                </tr>
              </table>
            </Section>

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
