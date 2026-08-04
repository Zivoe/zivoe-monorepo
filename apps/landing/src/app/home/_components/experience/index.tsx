import { type ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { ArrowRightIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { EMAILS } from '@/lib/utils';

import Container from '@/components/container';
import NewsletterHeader from '@/components/newsletter/common/newsletter-header';
import { TowerLeftIcon } from '@/components/tower-left-icon';

import NewsletterForm from '../../../../components/newsletter/common/newsletter-form';
import {
  CapitalOneIcon,
  CentrifugeIcon,
  ChainalysisIcon,
  CowSwapIcon,
  JPMorganIcon,
  M0Icon,
  MapleIcon,
  RuntimeIcon,
  RwaioIcon,
  SecuritizeIcon,
  SherlockIcon,
  WellsFargoIcon
} from './assets';
import { TowerRightDesktopIcon } from './assets/tower-right-desktop';
import { TowerRightMobileIcon } from './assets/tower-right-mobile';
import { TowerRightTabletIcon } from './assets/tower-right-tablet';

export default function Experience() {
  return (
    <div className="relative overflow-clip bg-surface-elevated-low-emphasis">
      <Container className="w-full pt-20 sm:px-10 sm:pt-28 md:w-140 md:px-0 xl:w-auto xl:px-35 xl:pt-40">
        <div className="z-10 mb-20 flex flex-col items-center justify-between gap-16 sm:gap-20 xl:mb-30 xl:flex-row xl:items-start 2xl:gap-[13.2rem]">
          <div className="flex flex-col gap-8 sm:gap-10 xl:mt-8 xl:max-w-160">
            <div className="flex flex-col gap-6">
              <h2 className="font-heading! text-subheading text-primary sm:text-h4 xl:text-h3">
                Driven by Experience. Powered by Collaboration.
              </h2>

              <div>
                <p className="text-leading text-primary sm:text-smallSubheading">
                  Zivoe is run by a team of industry veterans and supported by world-class partners in finance,
                  security, and compliance.
                </p>
                <br />
                <p className="text-leading text-primary sm:text-smallSubheading">Interested in working together?</p>
              </div>
            </div>

            <Link variant="primary" href={`mailto:${EMAILS.INVESTORS}`} size="l">
              Let's Talk
            </Link>
          </div>

          <div className="flex w-full flex-col gap-14 sm:gap-20 xl:max-w-120 2xl:max-w-171">
            <Section
              title="Experienced Leadership"
              description="Our team combines expertise from leading financial institutions."
              extra={
                <Link href="/about-us" variant="link-neutral-dark" size="m">
                  Meet the Team
                  <ArrowRightIcon />
                </Link>
              }
            >
              <Partner>
                <JPMorganIcon />
              </Partner>

              <Partner className="px-0">
                <WellsFargoIcon />
              </Partner>

              <div className="flex gap-4">
                <Partner>
                  <MapleIcon />
                </Partner>

                <Partner>
                  <CapitalOneIcon />
                </Partner>
              </div>
            </Section>

            <Section
              title="Compliance-First Approach"
              description="We collaborate with Securitize and Chainalysis to ensure we meet the highest standards of regulatory compliance."
            >

              <Partner>
                <ChainalysisIcon />
              </Partner>
            </Section>

            <Section
              title="Infrastructure & Ecosystem Partners"
              description="Zivoe works with specialized providers across the digital asset and private credit ecosystem."
            >
              <div className="flex flex-wrap gap-4">
                <Partner>
                  <CentrifugeIcon className="h-7 w-auto" />
                </Partner>
                <Partner>
                  <RwaioIcon />
                </Partner>
              </div>
            </Section>
          </div>
        </div>

        <div className="z-10 flex h-180 w-full justify-center pt-10 sm:h-[74.2rem] sm:pt-20 xl:h-140 xl:pt-30">
          <div className="flex w-full flex-col items-center gap-6 sm:w-fit sm:gap-14">
            <NewsletterHeader className="w-full sm:w-fit" />
            <NewsletterForm />
          </div>
        </div>
      </Container>

      <div className={'absolute bottom-0 left-0 w-80.25 sm:w-160 xl:w-214.5'}>
        <TowerLeftIcon />
      </div>

      <TowerRightDesktopIcon className="absolute -right-16 bottom-0 hidden xl:block 2xl:right-0" />
      <TowerRightTabletIcon className="absolute bottom-0 right-0 hidden sm:block xl:hidden" />
      <TowerRightMobileIcon className="absolute bottom-0 right-0 block sm:hidden" />
    </div>
  );
}

function Section({
  title,
  description,
  extra,
  children,
  className
}: {
  title: string;
  description: string;
  extra?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <p className="text-smallSubheading font-medium! text-brand-subtle sm:text-subheading">{title}</p>
          <p className="text-regular text-primary sm:text-leading">{description}</p>
        </div>

        <div>{extra}</div>
      </div>

      <div className={cn('flex flex-wrap gap-4', className)}>{children}</div>
    </div>
  );
}

function Partner({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex h-14 w-fit items-center rounded-lg bg-surface-base px-4', className)}>{children}</div>
  );
}
