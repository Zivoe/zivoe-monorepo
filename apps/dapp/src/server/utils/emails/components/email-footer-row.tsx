import { type ReactNode } from 'react';

import { Link, Text } from '@react-email/components';

export function EmailFooterRow({
  leftContent,
  unsubscribeUrl,
  leftWidth = '60%',
  rightWidth = '40%',
  leftCellStyle,
  rightCellStyle,
  leftTextClassName,
  unsubscribeLinkClassName
}: {
  leftContent: ReactNode;
  unsubscribeUrl?: string;
  leftWidth?: string;
  rightWidth?: string;
  leftCellStyle?: React.CSSProperties;
  rightCellStyle?: React.CSSProperties;
  leftTextClassName: string;
  unsubscribeLinkClassName: string;
}) {
  return (
    <table role="presentation" width="100%" cellPadding="0" cellSpacing="0">
      <tbody>
        <tr>
          <td width={leftWidth} style={{ verticalAlign: 'middle', ...leftCellStyle }}>
            <Text className={leftTextClassName}>{leftContent}</Text>
          </td>

          <td width={rightWidth} align="right" style={{ verticalAlign: 'middle', ...rightCellStyle }}>
            {unsubscribeUrl ? (
              <Link href={unsubscribeUrl} className={unsubscribeLinkClassName}>
                Unsubscribe
              </Link>
            ) : null}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
