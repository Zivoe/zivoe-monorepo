import { ZSmbLogo } from '@zivoe/ui/icons';

import { type ZivoeVaultFor } from './zivoe-vault';

/** Zivoe SMB Credit — the zSMB share class. */
export const ZSMB_ZIVOE_VAULT: ZivoeVaultFor<'zsmb'> = {
  slug: 'zivoe-smb-credit',
  name: 'Zivoe SMB Credit',
  Logo: ZSmbLogo,
  category: 'Small Business Financing',
  status: 'Open',
  CardArtwork: ZSmbCardArtwork,
  issuer: 'Zivoe',
  shareClass: { key: 'zsmb' },
  shareTokenDescription: 'Zivoe SMB Credit',
  targetApyPercent: 14,

  about: [
    'Zivoe’s tokenized small-business financing vault. Capital supplied through zSMB supports short-duration financing to small and medium-sized businesses across the United States. Zivoe provides secured financing to approved lending partners, which originate and service the underlying loans and collect borrower repayments.',
    'The facilities are secured by the underlying receivables and monitored against defined credit and performance standards. Participation involves risk, including possible loss of capital. Returns are not guaranteed. Review the vault details and applicable disclosures before participating.'
  ],

  details: {
    Geography: 'United States',
    'Entry/exit fees': 'None',
    Redemptions: 'Processed weekly',
    Eligibility: 'U.S. accredited investors & eligible non-U.S. persons'
  },

  documents: [{ title: 'Reg S Compliance', href: 'https://docs.zivoe.com/terms/reg-s-compliance' }]
};

/**
 * Inline rather than a `/public` file so the banner paints with the HTML — a
 * fetched image left the card blank on slow networks until it arrived.
 * `slice` crops to fill the banner, like `object-cover`.
 */
function ZSmbCardArtwork({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 90" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden className={className}>
      <rect width="200" height="90" fill="#D4EAFF" />
      <path d="M141 16L152.258 22.5V35.5L141 42L129.742 35.5V22.5L141 16Z" fill="#FCC62D" />
      <ellipse cx="55" cy="107" rx="115" ry="55" fill="#FFB887" />
      <ellipse cx="210" cy="118" rx="130" ry="60" fill="#F9A568" />
      <ellipse cx="100" cy="118" rx="120" ry="50" fill="#F08F48" />
    </svg>
  );
}
