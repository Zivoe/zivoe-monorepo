import { ZSmbLogo } from '@zivoe/ui/icons';

import { type ZivoeVault } from './zivoe-vault';

/** Zivoe SMB Credit — the zSMB share class. */
export const ZSMB_ZIVOE_VAULT: ZivoeVault = {
  slug: 'zivoe-smb-credit',
  name: 'Zivoe SMB Credit',
  Logo: ZSmbLogo,
  category: 'Small Business Financing',
  status: 'Open',
  cardArtworkSrc: '/zivoe-vault-zsmb-card.svg',
  issuer: 'Zivoe',
  shareClass: { key: 'zsmb' },
  centrifugeVaults: {
    sepolia: { address: '0x7Bfa3382eC44e2279BBf0c555B87702fbbFf3AD6', deployable: true },
    mainnet: { address: '0xD3A4fe3E0d0b89fFaf43D296727540C23de6d639', deployable: true }
  },
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
