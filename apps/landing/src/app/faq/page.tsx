import { type ReactNode } from 'react';

import { type Metadata } from 'next';

import { Disclosure, DisclosureGroup, DisclosureHeader, DisclosurePanel } from '@zivoe/ui/core/disclosure';

import { JsonLd, SITE_ORIGIN } from '@/lib/seo';

import Container from '@/components/container';
import Footer from '@/components/footer';
import NavigationSection from '@/components/navigation';
import Newsletter from '@/components/newsletter';
import { TowerLeftIcon } from '@/components/tower-left-icon';

export const metadata: Metadata = {
  title: 'FAQ | Zivoe',
  description: 'Answers to common questions about Zivoe, our features, and services.',
  alternates: {
    canonical: '/faq'
  }
};

export default function FAQPage() {
  return (
    <>
      <JsonLd data={faqJsonLd} />
      <div className="bg-surface-base lg:h-23">
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
      <Container className="gap-10 px-4 pb-2 pt-12 sm:px-10 lg:flex-row lg:pb-28 lg:pt-40 xl:gap-30 xl:px-43">
        <div className="flex w-full flex-col gap-4 lg:max-w-110">
          <h1 className="text-h4 text-primary lg:text-h2">Your Questions, Answered</h1>
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

      <div className="absolute -bottom-22 left-0 hidden w-150 lg:block">
        <TowerLeftIcon />
      </div>
    </div>
  );
}

const FAQs: Array<{
  question: string;
  answer: ReactNode;
  jsonLdAnswer?: string;
}> = [
  {
    question: 'What is Zivoe?',
    answer:
      'Zivoe is a real world asset (RWA) credit protocol that allows anyone who qualifies to gain tokenized exposure to the private credit market, an asset class historically favored by institutions for its strong risk-adjusted returns. By connecting stablecoin deposits to off-chain lending, Zivoe makes access to this segment available to individuals, offering exposure to yield opportunities that were traditionally out of reach.'
  },
  {
    question: 'How have these loans performed historically?',
    answer:
      'Private credit has shown consistent performance across market cycles, providing stable returns even when public markets experienced volatility. During the 2008 financial crisis, when traditional credit contracted sharply, many private lenders continued to perform, supported by disciplined underwriting and diversified borrower bases. This history underscores the resilience of private credit as an asset class.'
  },
  {
    question: 'What are the risks?',
    answer:
      'Note, Zivoe only serves as a technology interface, and as with all forms of private credit exposure, there are risks. Borrower defaults, underwriting errors, and broader economic conditions can all impact loan performance. Liquidity is also a consideration, as withdrawals are contingent on available liquidity. To mitigate these risks, Zivoe partners with established asset originators who handle underwriting and loan origination.'
  },
  {
    question: 'How do I earn yield?',
    answer:
      'Depositors receive zMCA, the Centrifuge pool’s share token, by depositing USDC. These funds are deployed off-chain into yield-generating private credit assets originated by Zivoe’s partners. Interest and principal payments from those assets increase the pool’s net asset value and are reflected in the zMCA Share Price.'
  },
  {
    question: 'What are the fees?',
    answer:
      'Zivoe currently takes a 15% protocol fee on the gross interest income generated from loan repayments. This fee supports ongoing operational costs, audits, and future development of the protocol. The remaining yield accrues to zMCA holders through the pool’s Share Price.'
  },
  {
    question: 'Is there a minimum deposit amount?',
    answer:
      'Unlike many other real world asset credit protocols, Zivoe is built to be accessible to all who qualify, and as such there is no minimum deposit amount. You can deposit as much or as little as you would like.'
  },
  {
    question: 'What is the lockup and liquidity policy?',
    answer:
      'Zivoe enforces no lockup period. You can submit a redemption request in the dApp at any time. Requests are processed periodically and remain subject to available liquidity; once processed, the USDC is ready to claim in the dApp.',
    jsonLdAnswer:
      'Zivoe enforces no lockup period. You can submit a redemption request in the dApp at any time. Requests are processed periodically and remain subject to available liquidity; once processed, the USDC is ready to claim in the dApp.'
  },
  {
    question: 'Has Zivoe been audited?',
    answer:
      "Yes. Zivoe's smart contracts have been audited by Runtime Verification and Sherlock, two leading security firms in the blockchain industry. In addition to these audits, Zivoe employs continuous monitoring systems to track protocol activity, flag anomalies, and uphold operational security standards."
  }
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  '@id': `${SITE_ORIGIN}/faq#faq`,
  mainEntity: FAQs.map(({ question, answer, jsonLdAnswer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: jsonLdAnswer ?? (typeof answer === 'string' ? answer : '')
    }
  }))
};
