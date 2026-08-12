import { Body, Container, Head, Hr, Html, Img, Preview, Section, Tailwind, Text } from '@react-email/components';

import { ZIVOE_LOGO_URL, emailTailwindConfig } from '../config';
import { EmailFooterRow } from './email-footer-row';

const DISCLOSURE_PARAGRAPHS = [
  'For informational purposes only. This communication does not constitute an offer to sell or a solicitation of an offer to buy any security, token, vault interest, or other financial product. Any offer will be made only through the applicable offering documents and only in jurisdictions where permitted by law.',
  'Deposits are open to eligible participants, subject to verification, whitelisting, jurisdictional restrictions, and the applicable vault terms. Participation is limited to verified U.S. accredited investors and eligible non-U.S. persons.',
  'Participation involves risk, including credit and default risk, limited liquidity, technology and operational risk, regulatory risk, and the possible loss of some or all of your capital. Returns are not guaranteed. Review the applicable vault terms and disclosures before participating.'
];

export function EmailLayout({
  preview,
  children,
  unsubscribeUrl,
  showDisclosure = false
}: {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
  /** Marketing emails carry the fine-print disclosure; transactional emails (OTP) stay clean. */
  showDisclosure?: boolean;
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

            {showDisclosure ? (
              <Section className="mb-6">
                {DISCLOSURE_PARAGRAPHS.map((paragraph) => (
                  <Text key={paragraph.slice(0, 32)} className="m-0 mb-3 text-[9px] leading-[13px] text-neutral-400">
                    {paragraph}
                  </Text>
                ))}
              </Section>
            ) : null}

            <EmailFooterRow
              leftContent="Zivoe - The Private Credit Layer for Stablecoins"
              unsubscribeUrl={unsubscribeUrl}
              leftWidth="75%"
              rightWidth="25%"
              leftTextClassName="m-0 text-[11px] text-neutral-400"
              unsubscribeLinkClassName="text-xs text-neutral-500 no-underline"
            />
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
