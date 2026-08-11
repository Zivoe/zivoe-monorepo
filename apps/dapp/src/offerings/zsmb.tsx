import { ZSmbLogo } from '@zivoe/ui/icons';

import { type Offering } from './offering';

/** Zivoe SMB Credit — the zSMB share class. */
export const ZSMB_OFFERING: Offering = {
  slug: 'zivoe-smb-credit',
  name: 'Zivoe SMB Credit',
  Logo: ZSmbLogo,
  category: 'Small Business Financing',
  status: 'Open',
  cardArtworkSrc: '/offering-zsmb-card.svg',
  issuer: 'Zivoe',
  shareClass: { key: 'zsmb' },
  vaults: {
    sepolia: { address: '0x8D46D06C0D274F9e277e71606Db602e57A055644', deployable: true },
    mainnet: { address: '0x50aE66E07c6311C2eE4a327378ddf33e46BEe6Bf', deployable: true }
  },
  shareTokenDescription: 'Zivoe SMB Credit',
  targetApyPercent: 14,

  about: [
    'Zivoe’s tokenized small-business financing vault. Capital supplied through zSMB supports short-duration financing to small and medium-sized businesses across the United States. Zivoe provides secured financing to approved lending partners, which originate and service the underlying loans and collect borrower repayments.',
    'The facilities are secured by the underlying receivables and monitored against defined credit and performance standards. Participation involves risk, including possible loss of capital. Returns are not guaranteed. Review the vault details and applicable disclosures before participating.'
  ],

  details: {
    Geography: 'United States',
    Inception: 'August 8 2026',
    'Entry/exit fees': 'None',
    Redemptions: 'Processed weekly',
    Eligibility: 'U.S. accredited investors & eligible non-U.S. persons'
  },

  documents: [{ title: 'Reg S Compliance', href: 'https://docs.zivoe.com/terms/reg-s-compliance' }]
};
