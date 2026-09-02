import { Body, Container, Head, Hr, Html, Img, Preview, Section, Tailwind, Text } from '@react-email/components';

import { ZIVOE_LOGO_URL, emailTailwindConfig } from '../config';
import { EmailFooterRow } from './email-footer-row';

/** Both disclosures carry the same risk language verbatim — one string, so it cannot drift. */
const RISK_PARAGRAPH =
  'Participation involves risk, including credit and default risk, limited liquidity, technology and operational risk, regulatory risk, and the possible loss of some or all of your capital. Returns are not guaranteed. Review the applicable vault terms and disclosures before participating.';

/**
 * Two sets of fine print, one per kind of email: `general` for the ones that
 * pitch the product, `transaction` for the receipts, which describe activity
 * that already happened and so disclaim status rather than solicitation.
 */
const DISCLOSURE_PARAGRAPHS = {
  general: [
    'For informational purposes only. This communication does not constitute an offer to sell or a solicitation of an offer to buy any security, token, vault interest, or other financial product. Any offer will be made only through the applicable offering documents and only in jurisdictions where permitted by law.',
    'Deposits are open to eligible participants, subject to verification, whitelisting, jurisdictional restrictions, and the applicable vault terms. Participation is limited to verified U.S. accredited investors and eligible non-U.S. persons.',
    RISK_PARAGRAPH
  ],
  transaction: [
    'This email concerns activity associated with your Zivoe account and summarizes the transaction status shown above as of the stated date and time. It is not an offer, solicitation, or investment recommendation.',
    'Your participation remains subject to the applicable vault terms, subscription agreement, and offering documents. This notification does not amend or replace those documents.',
    RISK_PARAGRAPH,
    'If you do not recognize this activity or believe any information is incorrect, contact inquire@zivoe.com promptly.'
  ]
} as const;

export function EmailLayout({
  preview,
  children,
  unsubscribeUrl,
  disclosure,
  headStyles
}: {
  preview: string;
  children: React.ReactNode;
  unsubscribeUrl?: string;
  /**
   * Which fine print to close with. Every email names one except the sign-in
   * code, which stays clean.
   */
  disclosure?: keyof typeof DISCLOSURE_PARAGRAPHS;
  /**
   * Raw CSS for the document head. Media queries cannot be expressed inline,
   * so a template needing responsive rules (the receipts' token-flow row)
   * passes them here rather than forking the layout.
   */
  headStyles?: string;
}) {
  return (
    <Html>
      <Head>{headStyles ? <style>{headStyles}</style> : null}</Head>
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

            {disclosure ? (
              <Section className="mb-6">
                {DISCLOSURE_PARAGRAPHS[disclosure].map((paragraph) => (
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
