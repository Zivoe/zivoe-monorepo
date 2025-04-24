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
    <>
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

      <div className="absolute -bottom-[5rem] left-0 hidden w-[600px] lg:block">
        <TowerLeftIcon />
      </div>
    </>
  );
}

const FAQs: Array<{
  question: string;
  answer: string;
}> = [
  {
    question: 'What is Zivoe?',
    answer:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
  },
  {
    question: 'How have these loans performed historically?',
    answer:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
  },
  {
    question: 'What are the risks?',
    answer:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
  },
  {
    question: 'How do I earn yield?',
    answer:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
  },
  {
    question: 'What are the fees?',
    answer:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
  },
  {
    question: 'What is the lockup period and liquidity policy?',
    answer:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
  },
  {
    question: 'Has Zivoe been audited?',
    answer:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'
  }
];
