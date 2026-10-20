import { EMAILS } from '@/lib/emails';

import { KycEmailShell } from './components/kyc-email-shell';

/**
 * The one Wallet link email: sent the first time the reconcile sees a linked
 * address a member everywhere. The address is shortened here (the shape of
 * `truncateAddress`) rather than imported: `@/lib/utils` drags next/server,
 * Sentry and the toast runtime into a template.
 */
export default function AddressWhitelistedEmail({
  name,
  address,
  vaultsUrl
}: {
  name?: string;
  address: string;
  vaultsUrl: string;
}) {
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;

  return (
    <KycEmailShell
      preview="Your address is whitelisted."
      heading="Your address is whitelisted"
      name={name}
      paragraphs={[
        `The address ${shortAddress} is now whitelisted for Zivoe vaults. You can deposit from it right away.`,
        `If you did not link this address, contact us at ${EMAILS.INQUIRE}.`
      ]}
      cta={{ label: 'Open the vaults', href: vaultsUrl }}
    />
  );
}
