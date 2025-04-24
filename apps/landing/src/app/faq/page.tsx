import { Disclosure, DisclosureGroup, DisclosureHeader, DisclosurePanel } from '@zivoe/ui/core/disclosure';

import Container from '@/components/container';
import Footer from '@/components/footer';
import NavigationSection from '@/components/navigation';
import Newsletter from '@/components/newsletter';
import { TowerLeftIcon } from '@/components/tower-left-icon';

export default function FAQPage() {
  return (
    <>
      <div className="bg-surface-base lg:h-[5.75rem]">
        <NavigationSection />
      </div>

      <Faq />

      <Newsletter />
      <Footer />
    </>
  );
}

function Faq() {
  return (
    <div className="relative">
      <Container className="gap-10 px-4 pb-2 pt-12 sm:px-10 lg:flex-row lg:pb-[7rem] lg:pt-[10rem] xl:gap-[7.5rem] xl:px-[10.75rem]">
        <div className="flex w-full flex-col gap-4 lg:max-w-[27.5rem]">
          <p className="text-h4 text-primary lg:text-h2">Your Questions, Answered</p>
          <p className="text-regular text-primary lg:text-leading">
            Here you can find answers to common questions about our Zivoe, our features, and services.
          </p>
        </div>

        <DisclosureGroup className="-mt-4 w-full">
          {FAQs.map(({ question, answer }) => (
            <Disclosure key={question}>
              <DisclosureHeader>{question}</DisclosureHeader>
              <DisclosurePanel>{answer}</DisclosurePanel>
            </Disclosure>
          ))}
        </DisclosureGroup>
      </Container>

      <div className="absolute -bottom-[5.5rem] left-0 hidden w-[600px] lg:block">
        <TowerLeftIcon />
      </div>
    </div>
  );
}

const FAQs: Array<{
  question: string;
  answer: string;
}> = [
  {
    question: 'What is Zivoe?',
    answer:
      'Zivoe is a real world asset (RWA) credit protocol that allows anyone who qualifies to gain tokenized exposure to the U.S. consumer lending market, an asset class historically favored by institutions for its strong risk-adjusted returns. By connecting stablecoin deposits to off-chain lending, Zivoe makes access to this segment of the credit market available to individuals for the first time, offering exposure to yield opportunities that were traditionally out of reach.'
  },
  {
    question: 'How have these loans performed historically?',
    answer:
      'The asset class Zivoe lends into is U.S. consumer credit, which has historically shown resilience even during economic downturns. During the 2008 financial crisis, access to revolving credit shrank by over $140 billion for underserved Americans. In contrast, Elevate Credit, a non-prime lender that maintained consistent performance through that period and later went public, was led at the time of its IPO by Walt Ramsey, now with Zivoe. This history underscores the durability of well-structured consumer credit portfolios, even in volatile market environments.'
  },
  {
    question: 'What are the risks?',
    answer:
      'As with all forms of private credit exposure, there are risks. Borrower defaults, underwriting errors, and broader economic conditions can all impact loan performance. Liquidity is also a consideration, as withdrawals are tied to loan repayments. Zivoe mitigates these risks by working with Zinclusive, its lending partner, who is responsible for underwriting and originating loans. Capital is deployed into a broad set of U.S.-based consumer loans, offering meaningful diversification compared to protocols concentrated in a small number of business loans.'
  },
  {
    question: 'How do I earn yield?',
    answer:
      "Depositors mint zveUSD, Zivo\'s ERC-4626 vault token, by depositing stablecoins into the protocol. These funds are used off-chain to help fund consumer loans. As borrowers repay those loans with interest, capital flows back into the protocol and is automatically compounded into zveUSD, allowing depositors to passively earn real, on-chain yield backed by off-chain repayments."
  },
  {
    question: 'What are the fees?',
    answer:
      'Zivoe currently takes a 15% protocol fee on the net interest income generated from loan repayments. This fee supports ongoing operational costs, audits, and future development of the protocol. The remaining yield is distributed to zveUSD holders, allowing them to earn the full benefit of on-chain cash flows after expenses.'
  },
  {
    question: 'What is the lockup period and liquidity policy?',
    answer:
      'Withdrawals from the protocol are subject to available cash flows from underlying loan repayments. While Zivoe may open select windows for direct redemptions once critical scale is reached, the primary path for liquidity will be through secondary markets. Zivoe has established a liquidity partnership with Frax, one of the leading stablecoin projects in the space, including a joint pool to support trading of zveUSD. This provides users with flexible access to exit their positions without waiting on scheduled redemption events.'
  },
  {
    question: 'How does the migration to zveUSD work?',
    answer:
      'Zivoe is transitioning from its original tranche-based system to a unified auto-compounding vault token called zveUSD, which will launch alongside a new dApp. While the Legacy App will remain live and continue to accept senior tranche deposits, all new protocol activity will move to zveUSD going forward. The full transition will occur with the launch of the new dApp, and a migration process will be shared for existing users. More details will be available soon through the dApp and Zivoe’s community channels.'
  },
  {
    question: 'Has Zivoe been audited?',
    answer:
      'Yes. Zivoe’s smart contracts have been audited by Runtime Verification and Sherlock, two leading security firms in the blockchain industry. In addition to these audits, Zivoe employs continuous monitoring systems to track protocol activity, flag anomalies, and uphold operational security standards.'
  }
];
