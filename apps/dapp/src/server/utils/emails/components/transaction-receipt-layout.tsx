import { type ReactNode } from 'react';

import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Tailwind, Text } from '@react-email/components';

import { ZIVOE_LOGO_URL, emailTailwindConfig } from '../config';
import {
  RECEIPT_COPYRIGHT_TEXT,
  RECEIPT_DISCLAIMER_TEXT,
  RECEIPT_INQUIRIES_EMAIL,
  RECEIPT_QUICK_LINKS
} from '../receipt-config';

export function TransactionReceiptLayout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html>
      <Head>
        <style>{`
          .receipt-desktop-token-flow {
            display: none !important;
            width: 100% !important;
            mso-hide: all !important;
          }

          .receipt-mobile-token-flow {
            display: table !important;
            width: 100% !important;
          }

          @media only screen and (min-width: 601px) {
            .receipt-desktop-token-flow {
              display: table !important;
              mso-hide: none !important;
            }

            .receipt-mobile-token-flow {
              display: none !important;
              mso-hide: all !important;
            }
          }
        `}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Tailwind config={emailTailwindConfig}>
        <Body className="font-sans bg-surface-elevated py-10">
          <Container className="mx-auto w-full max-w-[600px] border border-subtle bg-surface-base">
            <Section className="border-b border-subtle p-6">
              <Img src={ZIVOE_LOGO_URL} width="112" height="33" alt="Zivoe" />
            </Section>

            <Section className="px-8 py-10" style={{ width: '100%' }}>
              {children}
            </Section>

            <Section className="bg-surface-brand px-8 py-8" style={{ width: '100%' }}>
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0" style={{ marginBottom: '40px' }}>
                <tbody>
                  <tr>
                    <td width="50%" style={{ paddingRight: '16px', verticalAlign: 'top' }}>
                      <Text className="m-0 text-extraSmall text-disabled">INQUIRIES</Text>
                      <Text className="m-0 mt-2 text-small leading-5 text-disabled">
                        <Link
                          href={`mailto:${RECEIPT_INQUIRIES_EMAIL}`}
                          className="text-base no-underline"
                          style={{ fontSize: 'inherit', lineHeight: 'inherit' }}
                        >
                          {RECEIPT_INQUIRIES_EMAIL}
                        </Link>
                      </Text>
                    </td>

                    <td width="50%" style={{ verticalAlign: 'top' }}>
                      <Text className="m-0 text-extraSmall text-disabled">QUICK LINKS</Text>

                      {RECEIPT_QUICK_LINKS.map((link) => (
                        <Text key={link.label} className="m-0 mt-2 text-small leading-5 text-disabled">
                          <Link
                            href={link.href}
                            className="text-base no-underline"
                            style={{ fontSize: 'inherit', lineHeight: 'inherit' }}
                          >
                            {link.label}
                          </Link>
                        </Text>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>

              <Section style={{ marginBottom: '24px', width: '100%' }}>
                <Text className="m-0 mb-2 text-extraSmall text-disabled">DISCLAIMER</Text>
                <Text className="m-0 text-extraSmall text-disabled">{RECEIPT_DISCLAIMER_TEXT}</Text>
              </Section>

              <Text className="m-0 text-extraSmall text-disabled">{RECEIPT_COPYRIGHT_TEXT}</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
