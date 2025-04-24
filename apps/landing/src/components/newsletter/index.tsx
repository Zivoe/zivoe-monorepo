import Container from '@/components/container';
import NewsletterForm from '@/components/newsletter/common/newsletter-form';
import NewsletterHeader from '@/components/newsletter/common/newsletter-header';

import { NewsletterPatternIcon } from './assets/pattern';
import { NewsletterPatternMobileIcon } from './assets/pattern-mobile';

export default function Newsletter() {
  return (
    <div className="relative overflow-clip bg-element-primary-contrast">
      <Container className="flex-col items-start gap-8 py-16 sm:items-center sm:gap-14 sm:py-28">
        <NewsletterHeader className="z-10" type="light" />

        <div className="z-10 w-full sm:w-fit">
          <NewsletterForm />
        </div>
      </Container>

      <NewsletterPatternMobileIcon className="absolute left-0 top-0 h-fit w-full xl:hidden" />
      <NewsletterPatternIcon className="absolute left-0 top-0 hidden h-[102%] w-fit xl:block" />
      <NewsletterPatternIcon className="absolute right-0 top-0 hidden h-[102%] w-fit xl:block" />
    </div>
  );
}
