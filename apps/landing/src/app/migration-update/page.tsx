import { type ReactNode } from 'react';

import { type Metadata } from 'next';

import { NextLink } from '@zivoe/ui/core/link';
import { ArrowRightIcon } from '@zivoe/ui/icons';

import Container from '@/components/container';
import NavigationSection from '@/components/navigation';

export const metadata: Metadata = {
  title: 'Platform Migration Update | Zivoe',
  description:
    'Details about Zivoe’s August platform migration, the transition timeline, and what existing participants can expect.'
};

export default function MigrationUpdatePage() {
  return (
    <main>
      <div className="bg-surface-base lg:h-23">
        <NavigationSection />
      </div>

      <section className="bg-element-secondary-light">
        <Container className="grid gap-12 py-16 sm:px-10 sm:py-24 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:items-end lg:gap-18 lg:px-25 lg:py-28 xl:px-43">
          <div>
            <p className="text-brand-secondary-subtle text-small font-medium tracking-[0.12em] uppercase">
              Platform migration update
            </p>
            <h1 className="mt-5 max-w-215 text-h3 text-primary sm:text-h1 lg:text-large">Zivoe is leveling up.</h1>
            <p className="mt-7 max-w-190 text-leading text-secondary sm:text-smallSubheading">
              Zivoe is adopting Centrifuge infrastructure designed to support multiple networks, streamline the launch
              of new credit strategies, and connect real-world credit opportunities with institutional and stablecoin
              capital.
            </p>
          </div>

          <aside
            aria-label="Current migration status"
            className="border-secondary-200 bg-surface-base/85 rounded-xl border p-6 shadow-[0_18px_50px_rgba(117,70,40,0.07)] sm:p-7"
          >
            <p className="text-brand-secondary-subtle text-extraSmall font-medium tracking-[0.1em] uppercase">
              Current status
            </p>
            <p className="mt-3 text-h6 text-primary sm:text-h5">Your position will carry over automatically</p>
            <p className="mt-3 text-regular text-secondary">
              If you hold tokens in the current pool, you will automatically receive the new tokens via airdrop. No
              action is required.
            </p>
          </aside>
        </Container>
      </section>

      <section className="bg-surface-base">
        <Container className="grid gap-10 py-20 sm:px-10 sm:py-24 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20 lg:px-25 lg:py-40 xl:px-43">
          <div>
            <p className="text-brand-secondary-subtle text-small font-medium tracking-[0.12em] uppercase">
              What is changing
            </p>
            <h2 className="mt-5 max-w-150 text-h4 text-primary sm:text-h2">
              New infrastructure for Zivoe&apos;s next phase.
            </h2>
          </div>

          <div className="flex max-w-190 flex-col gap-5 text-leading text-secondary">
            <p>
              Zivoe is first migrating its existing SMB lending strategy onto Centrifuge infrastructure. The strategy
              itself is not changing. The infrastructure underneath it is.
            </p>
            <p>
              Future Zivoe vaults are planned to launch on the same infrastructure, giving the platform a consistent
              foundation for additional strategies and networks over time.
            </p>
            <p>
              From Monday, August 3 through Saturday, August 8, no transactions will be processed on the Zivoe platform
              while the migration is completed. Existing positions will carry over through the transition.
            </p>
          </div>
        </Container>
      </section>

      <section className="bg-surface-elevated-low-emphasis">
        <Container className="py-20 sm:px-10 sm:py-24 lg:px-25 lg:py-32 xl:px-43">
          <p className="text-brand-secondary-subtle text-small font-medium tracking-[0.12em] uppercase">
            Transition period
          </p>
          <h2 className="mt-5 text-h4 text-primary sm:text-h2">August 3 through August 8</h2>

          <div className="mt-10 grid max-w-230 gap-5 md:grid-cols-2">
            <TimelineCard date="Monday, August 3" heading="Transition begins">
              No transactions will be processed on the Zivoe platform while the migration is underway.
            </TimelineCard>

            <TimelineCard date="Saturday, August 8" heading="Migration scheduled to complete">
              The transition is scheduled to complete and deposits are scheduled to reopen through the new platform
              infrastructure.
            </TimelineCard>
          </div>
        </Container>
      </section>

      <section className="bg-element-primary">
        <Container className="py-20 sm:px-10 sm:py-24 lg:px-25 lg:py-28 xl:px-43">
          <p className="text-brand-secondary-subtle text-small font-medium tracking-[0.12em] uppercase">Questions</p>
          <h2 className="mt-5 max-w-190 text-h4 text-base sm:text-h2">Questions about the migration?</h2>
          <p className="mt-7 max-w-230 text-leading text-base/85 sm:text-smallSubheading">
            Contact the Zivoe team about the migration or an existing position at{' '}
            <a
              className="font-medium text-base underline underline-offset-4 hover:text-base/80"
              href="mailto:inquire@zivoe.com"
            >
              inquire@zivoe.com
            </a>
            .
          </p>

          <NextLink
            href="/"
            className="mt-6 inline-flex w-fit items-center gap-2 text-regular font-medium text-base hover:underline hover:underline-offset-4"
          >
            Return to the homepage
            <ArrowRightIcon aria-hidden="true" className="size-4" />
          </NextLink>
        </Container>
      </section>
    </main>
  );
}

function TimelineCard({ date, heading, children }: { date: string; heading: string; children: ReactNode }) {
  return (
    <article className="border-default bg-surface-base min-h-61 rounded-xl border p-7 sm:p-8">
      <time className="text-brand-secondary-subtle text-small font-medium tracking-[0.08em] uppercase">{date}</time>
      <h3 className="mt-10 text-h6 text-primary sm:text-h5">{heading}</h3>
      <p className="mt-3 text-regular text-secondary">{children}</p>
    </article>
  );
}
