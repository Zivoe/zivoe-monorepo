import { type Metadata } from 'next';

import { Link } from '@zivoe/ui/core/link';

import Container from '@/components/container';
import Footer from '@/components/footer';
import NavigationSection from '@/components/navigation';

export const metadata: Metadata = {
  title: 'Page Not Found | Zivoe',
  description: 'The Zivoe page you are looking for could not be found.'
};

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-base">
      <div className="bg-surface-base lg:h-[5.75rem]">
        <NavigationSection />
      </div>

      <main className="flex flex-1 bg-surface-base">
        <Container className="items-center justify-center px-4 py-24 text-center sm:px-10 lg:py-36">
          <div className="flex max-w-[42rem] flex-col items-center gap-8">
            <div className="flex flex-col gap-4">
              <p className="!font-heading text-small text-secondary sm:text-leading">404</p>
              <h1 className="text-h4 text-primary sm:text-h2">This page is not available</h1>
              <p className="text-regular text-secondary sm:text-leading">
                The link may be outdated, or the page may have moved.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/" variant="primary" size="l">
                Return Home
              </Link>
            </div>
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}
