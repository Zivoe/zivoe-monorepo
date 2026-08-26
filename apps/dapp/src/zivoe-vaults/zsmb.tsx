import { ZSmbLogo } from '@zivoe/ui/icons';

import { type ZivoeVaultFor } from './zivoe-vault';

/** Zivoe SMB Credit — the zSMB share class. */
export const ZSMB_ZIVOE_VAULT: ZivoeVaultFor<'zsmb'> = {
  slug: 'zivoe-smb-credit',
  name: 'Zivoe SMB Credit',
  Logo: ZSmbLogo,
  category: 'Small Business Financing',
  status: 'Open',
  cardArtworkSrc: '/zivoe-vault-zsmb-card.svg',
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
