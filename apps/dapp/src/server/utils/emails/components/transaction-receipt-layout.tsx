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
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind config={emailTailwindConfig}>
        <Body className="font-sans bg-surface-elevated py-10">
          <Container className="mx-auto w-full max-w-[600px] border border-subtle bg-surface-base">
            <Section className="border-b border-subtle p-6">
              <Img src={ZIVOE_LOGO_URL} width="112" height="33" alt="Zivoe" />
            </Section>

            <Section className="flex flex-col gap-6 px-8 py-10">{children}</Section>

            <Section className="flex flex-col gap-10 bg-surface-brand px-8 py-8">
              <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
                <tbody>
                  <tr>
                    <td width="50%" style={{ paddingRight: '16px', verticalAlign: 'top' }}>
                      <Text className="text-extraSmall text-disabled">INQUIRIES</Text>
                      <Link href={`mailto:${RECEIPT_INQUIRIES_EMAIL}`} className="text-small text-base no-underline">
                        {RECEIPT_INQUIRIES_EMAIL}
                      </Link>
                    </td>

                    <td width="50%" style={{ verticalAlign: 'top' }}>
                      <Text className="text-extraSmall text-disabled">QUICK LINKS</Text>

                      {RECEIPT_QUICK_LINKS.map((link) => (
                        <Text key={link.label} className="text-xs m-0 mb-2 leading-4">
                          <Link href={link.href} className="text-neutral-0 no-underline">
                            {link.label}
                          </Link>
                        </Text>
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>

              <Section>
                <Text className="text-extraSmall text-disabled">DISCLAIMER</Text>
                <Text className="text-extraSmall text-disabled">{RECEIPT_DISCLAIMER_TEXT}</Text>
              </Section>

              <Text className="text-extraSmall text-disabled">{RECEIPT_COPYRIGHT_TEXT}</Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
}
