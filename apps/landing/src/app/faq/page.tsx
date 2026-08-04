import { type ReactNode } from 'react';

import { type Metadata } from 'next';

import { Disclosure, DisclosureGroup, DisclosureHeader, DisclosurePanel } from '@zivoe/ui/core/disclosure';
import { Link } from '@zivoe/ui/core/link';

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
      'Zivoe connects institutional and stablecoin capital with regional private credit through a standardized platform. We work with experienced originators and support strategy administration, portfolio reporting, compliance workflows, and participant access. The platform is designed to support additional private credit strategies and networks over time.'
  },
  {
    question: 'What strategy is currently available through Zivoe?',
    answer: (
      <>
        Zivoe currently supports one private credit strategy focused on lending to small and medium-sized businesses. The strategy operates on Ethereum and is being migrated to Centrifuge infrastructure as part of the platform's next phase.
        <br />
        <br />
        Zivoe plans to support additional private credit strategies and blockchain networks over time, subject to completion of the necessary diligence, documentation, infrastructure, and approvals.
      </>
    )
  },
  {
    question: 'How can a Zivoe position generate returns?',
    answer:
      (
      <>
        The performance of a Zivoe position is linked to the applicable strategy and its underlying loans, subject to the strategy's terms. Those loans may generate income from interest and other borrower payments.
        <br />
        <br />
        After applicable fees, expenses, and credit losses, performance is reflected in a participant’s position according to the strategy’s terms. Assets and sources of income may vary by strategy. Returns are not fixed or guaranteed, and participants may lose some or all of their capital.
      </>
    )
  },
  {
    question: 'Who can participate?',
    answer:
      (
      <>
        Zivoe may be available to non-US persons who meet applicable eligibility requirements and accredited US investors, subject to the terms of the applicable offer.
        <br />
        <br />
        Participants will need to complete the identity, eligibility, and compliance verification applicable to their jurisdiction and status.
      </>
    )
  },
  {
    question: 'How do deposits and redemptions work?',
    answer:
      (
      <>
        Participants deposit supported stablecoins displayed on the platform. Once onboarding and applicable verification are complete, assets are allocated according to the strategy’s terms, and the participant receives a position in the strategy.
        <br />
        <br />
        Redemption requests are processed on a scheduled basis rather than immediately, subject to available liquidity, processing requirements, and the applicable terms.
      </>
    )
  },
  {
    question: 'What transparency and reporting will Zivoe provide?',
    answer:
      (
      <>
        At launch, participants will be able to review core information about their position and account activity through the Zivoe platform.
        <br />
        <br />
        Zivoe is developing an expanded transparency page to provide greater visibility into portfolio composition, performance, repayments, cash activity, and risk. It is planned for release after the migration, and Zivoe will share timing when confirmed.
        <br />
        <br />
        Information is updated as data is received and processed and may not be available in real time.
      </>
    )
  },
  {
    question: 'What fees, liquidity limitations, and risks apply?',
    answer:
      (
      <>
        Applicable fees, expenses, liquidity terms, and material risks are disclosed in the applicable materials before participation.
        <br />
        <br />
        Private credit involves risk, including borrower default, delayed repayment, limited liquidity, servicing, technology, and regulatory risks. Participants may lose some or all of their capital and should review the applicable documentation carefully.
      </>
    )
  },
  {
    question: 'What does Zivoe offer institutions?',
    answer:
      (
      <>
        Zivoe gives eligible institutions a standardized way to access private credit and work with regional originators through consistent structures, administration, and reporting. The platform is designed to support additional lending markets and strategy types over time.
        <br />
        <br />
        Zivoe works with allocators, treasuries, capital providers, and strategic partners across strategy access, origination relationships, and platform partnerships. Institutions can contact the Zivoe team through the For Institutions page.
      </>
    )
  },
  {
    question: 'How does Zivoe work with originators?',
    answer:
      (
      <>
        Zivoe partners with experienced originators that source, underwrite, and service loans in their markets. Zivoe provides the platform infrastructure around those assets, supporting strategy setup, portfolio administration, net asset value (NAV) reporting, compliance workflows, and investor reporting.
        <br />
        <br />
        The platform is designed to help originators connect with eligible capital without building the full operating stack themselves.
      </>
    )
  },
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
