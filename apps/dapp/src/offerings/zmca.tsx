import { ZMcaLogo } from '@zivoe/ui/icons';

import { type Offering } from './offering';

/** The Global MCA Offerings Fund — the zMCA share class. */
export const ZMCA_OFFERING: Offering = {
  slug: 'global-mca-offerings',
  name: 'Global MCA Offerings Fund',
  Logo: ZMcaLogo,
  category: 'Merchant Cash Advance',
  description:
    'Short-duration, revenue-based financing for small businesses, diversified across thousands of merchants in the US, UK, Europe and APAC with daily repayment.',
  cardGradient: [
    'radial-gradient(120% 120% at 18% 22%, rgba(255, 216, 174, 0.95), transparent 55%)',
    'radial-gradient(120% 130% at 86% 82%, rgba(224, 99, 143, 0.92), transparent 55%)',
    'linear-gradient(135deg, #f3a25c, #f08f48 45%, #d96b8f)'
  ].join(', '),
  issuer: 'Zivoe',
  shareClass: { key: 'zmca' },
  vaults: {
    sepolia: { address: '0x8D46D06C0D274F9e277e71606Db602e57A055644', deployable: true },
    // NON-DEPLOYABLE PLACEHOLDER: receipt decoding against the zero address
    // silently matches nothing, so resolution throws instead.
    mainnet: { address: '0x0000000000000000000000000000000000000000', deployable: false }
  },
  shareTokenDescription: 'Zivoe MCA',
  targetApyPercent: 14,

  about: [
    'zMCA offers qualified purchasers exposure to a diversified private credit portfolio—an asset class that has delivered strong, risk-adjusted returns on Wall Street for decades. The portfolio is composed primarily of short-duration credit instruments across several private credit verticals, including merchant cash advance, consumer credit, and more.',
    'zMCA is a yield-bearing token that delivers returns through price appreciation. As the underlying loan portfolio generates income and grows in value, this is reflected by a steadily increasing token price.',
    'zMCA seeks to provide consistent, risk-adjusted yields supported by a diversified, short-duration strategy and a team with decades of experience managing credit risk.'
  ],

  details: {
    Eligibility: 'Institutions & Non-US Retail',
    'Underlying Assets': 'Business & Consumer Loans',
    Geography: 'Americas and EU',
    'Legal Structure': 'SPV',
    'Regulatory Compliance': 'Reg S Compliant Offering',
    'Management Fee': '2.5% APR',
    Liquidity: 'Available upon request',
    Audits: { href: 'https://docs.zivoe.com/official-links/audits', label: 'View Reports' }
  },

  documents: [
    { title: 'Protocol Documentation', href: 'https://docs.zivoe.com/user-docs/introduction' },
    { title: 'Reg S Compliance', href: 'https://docs.zivoe.com/terms/reg-s-compliance' }
  ]
};
