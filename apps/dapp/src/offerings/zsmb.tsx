import { ZSmbLogo } from '@zivoe/ui/icons';

import { type Offering } from './offering';

/** Zivoe SMB Credit — the zSMB share class. */
export const ZSMB_OFFERING: Offering = {
  slug: 'zivoe-smb-credit',
  name: 'Zivoe SMB Credit',
  Logo: ZSmbLogo,
  category: 'Small Business Financing',
  status: 'Open',
  description:
    'Short-duration, revenue-based financing for small businesses, diversified across thousands of merchants in the US, UK, Europe and APAC with daily repayment.',
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
    'zSMB provides short-duration financing to small and medium-sized businesses across the United States, a multi-hundred-billion-dollar market that sits at the core of the American economy. Demand for credit in this segment consistently outpaces traditional supply, creating a durable lending opportunity with attractive risk-adjusted pricing that institutional credit managers have made a cornerstone of private credit allocations.',
    'Zivoe deploys capital through asset-backed credit facilities with established originators of these loans. Each facility is collateralized by the underlying advances made to businesses, meaning investor capital is secured by a large, diversified pool of receivables rather than any single borrower. These facilities are typically overcollateralized, with collateral value exceeding the capital Zivoe extends, providing a built-in cushion against portfolio losses alongside performance covenants and ongoing monitoring.',
    "zSMB is a yield-bearing token that delivers returns through price appreciation: as the underlying facilities generate interest income, the token's price steadily increases to reflect the growing value of the portfolio."
  ],

  details: {
    Geography: 'United States',
    Inception: 'August 8 2026',
    'Entry/exit fees': 'None',
    Redemptions: 'Processed weekly',
    Eligibility: 'U.S. Accredited & Non-US Investors'
  },

  documents: [{ title: 'Reg S Compliance', href: 'https://docs.zivoe.com/terms/reg-s-compliance' }]
};
