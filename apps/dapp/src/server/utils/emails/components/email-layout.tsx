import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Tailwind,
  Text
} from '@react-email/components';

import { ZIVOE_LOGO_URL, emailTailwindConfig } from '../config';

export function EmailLayout({ preview, children }: { preview?: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      {preview && <Preview>{preview}</Preview>}
      <Tailwind config={emailTailwindConfig}>
        <Body className="bg-neutral-50 font-sans">
          <Container className="border-neutral-200 bg-neutral-0 mx-auto my-10 max-w-[480px] rounded-xl border px-10 py-10">
            <Section className="mb-8 text-center">
              <Img src={ZIVOE_LOGO_URL} width="112" height="33" alt="Zivoe" className="mx-auto" />
            </Section>

            {children}

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
