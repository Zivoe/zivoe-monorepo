import { type ReactNode } from 'react';

import { Hr, Img, Link, Section, Text } from '@react-email/components';

import {
  RECEIPT_ARROW_RIGHT_GRAY_URL,
  RECEIPT_ARROW_RIGHT_TEAL_URL,
  RECEIPT_CHECK_CIRCLE_URL,
  RECEIPT_EXTERNAL_LINK_URL,
  RECEIPT_VIEW_IN_APP_URL,
  type ReceiptTokenSymbol,
  getReceiptTokenIconUrl
} from '../receipt-config';

type ReceiptTokenFlowAmount = {
  symbol: ReceiptTokenSymbol;
  value: string;
};

function ReceiptTokenAmount({ symbol, value }: ReceiptTokenFlowAmount) {
  const safeValue = value.replace(/\s+/g, '\u00A0');

  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" align="center">
      <tbody>
        <tr>
          <td style={{ paddingRight: '8px', verticalAlign: 'middle' }}>
            <Img src={getReceiptTokenIconUrl(symbol)} width="24" height="24" alt={symbol} />
          </td>

          <td style={{ verticalAlign: 'middle' }}>
            <Text className="m-0 text-leading text-primary" style={{ whiteSpace: 'nowrap' }}>
              {safeValue}
            </Text>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ReceiptTokenFlowRow({ from, to }: { from: ReceiptTokenFlowAmount; to: ReceiptTokenFlowAmount }) {
  return (
    <Section className="mb-6 rounded-md border border-subtle bg-surface-base-soft px-4 py-3" style={{ width: '100%' }}>
      <table
        role="presentation"
        width="100%"
        cellPadding="0"
        cellSpacing="0"
        className="receipt-desktop-token-flow"
        style={{ display: 'none', width: '100%' }}
      >
        <tbody>
          <tr>
            <td width="45%" align="center" style={{ verticalAlign: 'middle' }}>
              <ReceiptTokenAmount symbol={from.symbol} value={from.value} />
            </td>

            <td width="10%" align="center" style={{ verticalAlign: 'middle' }}>
              <Img src={RECEIPT_ARROW_RIGHT_GRAY_URL} width="16" height="16" alt="" />
            </td>

            <td width="45%" align="center" style={{ verticalAlign: 'middle' }}>
              <ReceiptTokenAmount symbol={to.symbol} value={to.value} />
            </td>
          </tr>
        </tbody>
      </table>

      <table
        role="presentation"
        width="100%"
        cellPadding="0"
        cellSpacing="0"
        className="receipt-mobile-token-flow"
        style={{ display: 'table', width: '100%' }}
      >
        <tbody>
          <tr>
            <td align="center" style={{ paddingBottom: '8px', verticalAlign: 'middle' }}>
              <ReceiptTokenAmount symbol={from.symbol} value={from.value} />
            </td>
          </tr>

          <tr>
            <td align="center" style={{ paddingBottom: '8px', verticalAlign: 'middle' }}>
              <Img src={RECEIPT_ARROW_RIGHT_GRAY_URL} width="16" height="16" alt="" />
            </td>
          </tr>

          <tr>
            <td align="center" style={{ verticalAlign: 'middle' }}>
              <ReceiptTokenAmount symbol={to.symbol} value={to.value} />
            </td>
          </tr>
        </tbody>
      </table>
    </Section>
  );
}

export function ReceiptDetailTable({ children }: { children: ReactNode }) {
  return (
    <Section className="mb-6" style={{ width: '100%' }}>
      {children}
    </Section>
  );
}

export function ReceiptDetailRow({
  label,
  value,
  withDivider = true
}: {
  label: string;
  value: ReactNode;
  withDivider?: boolean;
}) {
  return (
    <>
      <Section className="py-4" style={{ width: '100%' }}>
        <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
          <tbody>
            <tr>
              <td style={{ verticalAlign: 'middle', paddingRight: '12px' }}>
                <Text className="text-regular text-secondary">{label}</Text>
              </td>

              <td align="right" style={{ verticalAlign: 'middle' }}>
                {typeof value === 'string' ? <Text className="text-regular text-primary">{value}</Text> : value}
              </td>
            </tr>
          </tbody>
        </table>
      </Section>

      {withDivider ? <Hr className="m-0 border-subtle" /> : null}
    </>
  );
}

export function ReceiptSuccessBadge() {
  return (
    <table role="presentation" cellPadding="0" cellSpacing="0" align="right" style={{ width: 'auto' }}>
      <tbody>
        <tr>
          <td style={{ borderRadius: '4px', backgroundColor: '#E6F7F7', padding: '4px 8px' }}>
            <table role="presentation" cellPadding="0" cellSpacing="0">
              <tbody>
                <tr>
                  <td style={{ paddingRight: '6px', verticalAlign: 'middle' }}>
                    <Img src={RECEIPT_CHECK_CIRCLE_URL} width="12" height="12" alt="" />
                  </td>

                  <td style={{ verticalAlign: 'middle' }}>
                    <Text className="m-0 text-small leading-4 text-brand">Success</Text>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ReceiptExternalValueLink({ href, text }: { href: string; text: string }) {
  return (
    <table role="presentation" align="right" cellPadding="0" cellSpacing="0">
      <tbody>
        <tr>
          <td style={{ verticalAlign: 'middle' }}>
            <Link href={href} className="text-regular text-brand-subtle">
              {text}
            </Link>
          </td>

          <td style={{ paddingLeft: '6px', verticalAlign: 'middle' }}>
            <Img src={RECEIPT_EXTERNAL_LINK_URL} width="16" height="16" alt="" />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ReceiptCtaButton({
  href = RECEIPT_VIEW_IN_APP_URL,
  label = 'View In App'
}: {
  href?: string;
  label?: string;
}) {
  return (
    <Section className="text-center" style={{ width: '100%' }}>
      <Link
        href={href}
        className="block rounded-md border border-active px-4 py-4 text-center no-underline"
        style={{ display: 'block' }}
      >
        <table
          role="presentation"
          align="center"
          cellPadding="0"
          cellSpacing="0"
          style={{ width: 'auto', margin: '0 auto' }}
        >
          <tbody>
            <tr>
              <td style={{ width: '16px', minWidth: '16px', paddingRight: '8px', fontSize: '0', lineHeight: '0' }}>
                &nbsp;
              </td>

              <td style={{ verticalAlign: 'middle' }}>
                <Text className="m-0 text-regular font-medium leading-5 text-brand">{label}</Text>
              </td>

              <td style={{ width: '16px', minWidth: '16px', paddingLeft: '8px', verticalAlign: 'middle' }}>
                <Img src={RECEIPT_ARROW_RIGHT_TEAL_URL} width="16" height="16" alt="" />
              </td>
            </tr>
          </tbody>
        </table>
      </Link>
    </Section>
  );
}
