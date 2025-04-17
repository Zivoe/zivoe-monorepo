import { ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { ArrowRightIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import Container from '@/components/container';

import {
  CapitalOneIcon,
  ChainalysisIcon,
  CowSwapIcon,
  JPMorganIcon,
  M0Icon,
  MapleIcon,
  RuntimeIcon,
  RwaWorldIcon,
  SecuritizeIcon,
  SherlockIcon,
  WellsFargoIcon
} from './assets';
import { TowerRightDesktopIcon } from './assets/tower-right-desktop';
import { TowerRightMobileIcon } from './assets/tower-right-mobile';
import { TowerRightTabletIcon } from './assets/tower-right-tablet';
import Newsletter from './newsletter';

export default function Experience() {
  return (
    <div className="relative bg-surface-elevated-low-emphasis">
      <Container className="w-full pt-20 sm:px-10 sm:pt-[7rem] md:w-[35rem] md:px-0 xl:w-auto xl:px-[8.75rem] xl:pt-[10rem]">
        <div className="mb-20 flex flex-col items-center justify-between gap-16 sm:gap-20 xl:mb-[7.5rem] xl:flex-row xl:items-start 2xl:gap-[13.2rem]">
          <div className="flex flex-col gap-8 sm:gap-10 xl:mt-8 xl:max-w-[40rem]">
            <div className="flex flex-col gap-6">
              <p className="!font-heading text-subheading text-primary sm:text-h4 xl:text-h3">
                Driven by Experience. Powered by Collaboration.
              </p>

              <div>
                <p className="text-leading text-primary sm:text-smallSubheading">
                  Zivoe is run by a team of industry veterans and supported by world-class partners in finance,
                  security, and compliance.
                </p>
                <br />
                <p className="text-leading text-primary sm:text-smallSubheading">Interested in working together?</p>
              </div>
            </div>

            <Link variant="primary" href="/" size="l">
              Let's Talk
            </Link>
          </div>

          <div className="flex w-full flex-col gap-14 sm:gap-20 xl:max-w-[30rem] 2xl:max-w-[42.75rem]">
            <Section
              title="Experienced Leadership"
              description="Our team combines expertise from leading financial institutions and DeFi protocols."
              extra={
                <Link href="/" variant="link-neutral-dark" size="m">
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
              title="Audited by Top Security Firms"
              description="We work with industry-leading auditors to ensure our platform is secure and reliable."
              extra={
                <Link href="/" variant="link-neutral-dark" size="m">
                  Review Our Audits
                  <ArrowRightIcon />
                </Link>
              }
            >
              <Partner>
                <RuntimeIcon />
              </Partner>

              <Partner>
                <SherlockIcon />
              </Partner>
            </Section>

            <Section
              title="Compliance-First Approach"
              description="We collaborate with Securitize and Chainalysis to ensure we meet the highest standards of regulatory compliance."
            >
              <Partner>
                <SecuritizeIcon />
              </Partner>

              <Partner>
                <ChainalysisIcon />
              </Partner>
            </Section>

            <Section
              title="Collaborating with Industry Leaders"
              description="We are proud to work with top-tier partners across the DeFi ecosystem to deliver the best results for our clients."
            >
              <Partner>
                <M0Icon />
              </Partner>

              <Partner>
                <CowSwapIcon />
              </Partner>

              <Partner>
                <RwaWorldIcon />
              </Partner>
            </Section>
          </div>
        </div>

        <div className="flex h-[45rem] w-full justify-center pt-10 sm:h-[74.2rem] sm:pt-20 xl:h-[35rem] xl:pt-[7.5rem]">
          <div className="flex w-full flex-col items-center gap-6 sm:w-fit sm:gap-14">
            <div className="flex flex-col items-center gap-2 sm:gap-4 xl:gap-6">
              <p className="text-center !font-heading text-h5 text-primary sm:text-h2">Sign Up for Newsletter</p>
              <p className="text-center text-regular text-secondary sm:text-smallSubheading">
                Subtle background with the new branding.
              </p>
            </div>

            <Newsletter />
          </div>
        </div>
      </Container>

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
          <p className="text-smallSubheading !font-medium text-brand-subtle sm:text-subheading">{title}</p>
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
