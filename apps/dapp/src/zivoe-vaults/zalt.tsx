import { ZAltLogo } from '@zivoe/ui/icons';

import { type ZivoeVault } from './zivoe-vault';

/** Zivoe Alternative Credit — the zALT share class. */
export const ZALT_ZIVOE_VAULT: ZivoeVault = {
  slug: 'zivoe-alternative-credit',
  name: 'Zivoe Alternative Credit',
  Logo: ZAltLogo,
  category: 'Merchant Cash Advance',
  status: 'Deploying',
  cardArtworkSrc: '/zivoe-vault-zalt-card.svg',
  issuer: 'Zivoe',
  shareClass: { key: 'zalt' },
  centrifugeVaults: {
    sepolia: { address: '0x7Bfa3382eC44e2279BBf0c555B87702fbbFf3AD6', deployable: true },
    mainnet: { address: '0xD3A4fe3E0d0b89fFaf43D296727540C23de6d639', deployable: true }
  },
  shareTokenDescription: 'Zivoe Alternative Credit',
  targetApyPercent: 10,

  about: [
    'Capital in zALT is deployed across a portfolio of short-duration business loans in the United States and Europe. The portfolio is monitored against defined credit and performance standards in coordination with established lending partners.',
    'Participation involves risk, including possible loss of capital. Returns are not guaranteed. Review the vault details and applicable disclosures before participating.'
  ],

  details: {
    Geography: 'United States & Europe',
    Inception: 'September 2025',
    'Entry/exit fees': 'None',
    Redemptions: 'Processed weekly',
    Eligibility: 'U.S. accredited investors & eligible non-U.S. persons'
  },

  documents: [{ title: 'Reg S Compliance', href: 'https://docs.zivoe.com/terms/reg-s-compliance' }]
};
