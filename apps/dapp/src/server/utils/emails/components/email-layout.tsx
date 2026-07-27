import { Body, Container, Head, Hr, Html, Img, Preview, Section, Tailwind } from '@react-email/components';

import { ZIVOE_LOGO_URL, emailTailwindConfig } from '../config';
import { EmailFooterRow } from './email-footer-row';

export function EmailLayout({
  preview,
  children,
  unsubscribeUrl
}: {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind config={emailTailwindConfig}>
        <Body className="font-sans bg-neutral-50">
          {/* Email clients like Outlook ignore rem — keep email sizes as arbitrary px values */}
          <Container className="mx-auto my-10 max-w-[480px] rounded-xl border border-neutral-200 bg-neutral-0 px-10 py-10">
            <Section className="mb-8 text-center">
              <Img src={ZIVOE_LOGO_URL} width="112" height="33" alt="Zivoe" className="mx-auto" />
            </Section>

            {children}

            <Hr className="my-8 border-neutral-200" />

            <EmailFooterRow
              leftContent="Zivoe - RWA Credit Protocol"
              unsubscribeUrl={unsubscribeUrl}
              leftTextClassName="m-0 text-xs text-neutral-400"
              unsubscribeLinkClassName="text-xs text-neutral-500 no-underline"
            />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
