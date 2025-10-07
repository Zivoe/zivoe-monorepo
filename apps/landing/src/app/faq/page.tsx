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
            Here you can find answers to common questions about Zivoe, our features, and services.
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
      'Zivoe is a real world asset (RWA) credit protocol that allows anyone who qualifies to gain tokenized exposure to the private credit market, an asset class historically favored by institutions for its strong risk-adjusted returns. By connecting stablecoin deposits to off-chain lending, Zivoe makes access to this segment available to individuals, offering exposure to yield opportunities that were traditionally out of reach.'
  },
  {
    question: 'How have these loans performed historically?',
    answer:
      'The private credit segments Zivoe lends into, consumer loans and merchant cash advance loans, have demonstrated resilience and strong performance across multiple market cycles.\n\nConsumer credit has historically shown durability even during economic downturns. During the 2008 financial crisis, access to revolving credit shrank by over $140 billion for underserved Americans. In contrast, Elevate Credit, a non-prime lender that maintained consistent performance through that period and later went public, was led at the time of its IPO by Walt Ramsey, now with Zivoe.\n\nMerchant cash advance loans have also built a long track record of attractive, risk-adjusted returns by providing small and medium businesses with essential access to working capital.\n\nTogether, these histories underscore the durability of well-structured private credit portfolios, even in volatile market environments.'
  },
  {
    question: 'What are the risks?',
    answer:
      'Note, Zivoe only serves as a technology interface, and as with all forms of private credit exposure, there are risks. Borrower defaults, underwriting errors, and broader economic conditions can all impact loan performance. Liquidity is also a consideration, as withdrawals are contingent on available liquidity.'
  },
  {
    question: 'How do I earn yield?',
    answer:
      "Depositors mint zVLT, Zivoe's ERC-4626 vault token, by depositing stablecoins into the protocol. These funds are deployed off-chain into yield-generating consumer loans and merchant cash advance loans. Over time, capital from these assets flows back on-chain and is automatically compounded into zVLT, allowing depositors to passively earn real, on-chain yield backed by real world assets."
  },
  {
    question: 'What are the fees?',
    answer:
      'Zivoe currently takes a 15% protocol fee on the gross interest income generated from loan repayments. This fee supports ongoing operational costs, audits, and future development of the protocol. The remaining yield is distributed to zVLT holders, allowing them to earn the full benefit of on-chain cash flows after expenses.'
  },
  {
    question: 'Is there a minimum deposit amount?',
    answer:
      'Unlike many other real world asset credit protocols, Zivoe is built to be accessible to all who qualify, and as such there is no minimum deposit amount. You can deposit as much or as little as you would like.'
  },
  {
    question: 'What is the lockup and liquidity policy?',
    answer:
      'Zivoe enforces no lockup period, and you can withdraw from your zVLT position at any time liquidity permitting. To see how much liquidity is available for redemptions and to submit a redeem transaction, simply visit our dApp. In addition to redemptions, there is also an active zVLT / USDC Uniswap pool providing another venue for users to exit their position.'
  },
  {
    question: 'How do I convert my Tranche Tokens to zVLT?',
    answer:
      'Zivoe has transitioned from its original tranche-based system to a unified auto-compounding vault token called zVLT, which launched alongside our new dApp. Senior tranche token holders use their tokens in the new dApp to mint zVLT while junior tranche tokens holders will first need to visit our legacy dApp (a link to this can be found in the footer on this page) and convert their junior tranche tokens first to senior tranche tokens and then to zVLT.'
  },
  {
    question: 'Has Zivoe been audited?',
    answer:
      'Yes. Zivoe\'s smart contracts have been audited by Runtime Verification and Sherlock, two leading security firms in the blockchain industry. In addition to these audits, Zivoe employs continuous monitoring systems to track protocol activity, flag anomalies, and uphold operational security standards.'
  }
];
