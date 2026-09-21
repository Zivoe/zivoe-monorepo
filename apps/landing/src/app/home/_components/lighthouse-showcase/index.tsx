import { type ComponentType } from 'react';

import Image from 'next/image';

import { Link } from '@zivoe/ui/core/link';
import { ChartIcon, DropIcon, PieChartIcon } from '@zivoe/ui/icons';
import { type IconProps } from '@zivoe/ui/icons/types';

import { LIGHTHOUSE_URL } from '@/lib/utils';

import Container from '@/components/container';
import { LighthouseCta } from '@/components/lighthouse-cta';
import { LighthouseMark } from '@/components/lighthouse-mark';

const FEATURES: Array<{ title: string; description: string; Icon: ComponentType<IconProps> }> = [
  {
    title: 'View the portfolio',
    description: 'Explore portfolio composition and the breakdown of positions, cash, and other assets.',
    Icon: PieChartIcon
  },
  {
    title: 'Understand the positions',
    description: 'Review reported performance, asset metrics, and historical trends for individual credit positions.',
    Icon: ChartIcon
  },
  {
    title: 'Monitor liquidity',
    description: 'View available redemption reserves by network and stablecoin.',
    Icon: DropIcon
  }
];

export default function LighthouseShowcase() {
  return (
    <section id="lighthouse" aria-labelledby="lighthouse-heading" className="bg-primary-950 text-base">
      <Container className="gap-10 py-16 sm:gap-12 sm:px-10 sm:py-20 lg:gap-16 lg:py-24 xl:px-26 xl:py-28 2xl:px-48">
        <div className="grid w-full items-center gap-10 sm:gap-12 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] xl:gap-14">
          <div className="max-w-130">
            <div className="flex items-center gap-3 text-h7 text-primary-300">
              <LighthouseMark className="size-11" />
              <span>Lighthouse</span>
            </div>
            <h2 id="lighthouse-heading" className="mt-7 text-h4 text-balance sm:text-h2">
              A clearer view of private credit
            </h2>
            <p className="mt-6 max-w-110 text-leading text-base/80">
              Explore the portfolio, balance sheet, and liquidity in real-time with Lighthouse.
            </p>
            <div className="mt-8">
              <LighthouseCta />
            </div>
          </div>

          <figure className="min-w-0">
            <Link
              href={LIGHTHOUSE_URL}
              target="_blank"
              variant="link-base"
              hideExternalLinkIcon
              aria-label="Explore the Lighthouse dashboard (opens in a new tab)"
              aria-describedby="lighthouse-snapshot-caption"
              className="block w-full overflow-hidden rounded-2xl border border-base/15 bg-primary-900 p-1.5 shadow-[0_24px_56px_-32px_rgba(0,23,25,1)] transition-colors hover:border-primary-300 hover:no-underline focus-visible:ring-2 focus-visible:ring-primary-300 sm:rounded-3xl sm:p-2.5"
            >
              <Image
                src="/lighthouse-dashboard-2026-09-20.webp"
                alt="Lighthouse zSMB dashboard showing reported and on-chain metrics, a portfolio composition chart, and a NAV breakdown of credit positions, cash, and other assets."
                width={1920}
                height={1355}
                sizes="(min-width: 64rem) 60vw, 100vw"
                className="h-auto w-full rounded-xl"
              />
            </Link>
            <figcaption id="lighthouse-snapshot-caption" className="mt-4 text-right text-extraSmall text-base/70">
              Dashboard snapshot · <time dateTime="2026-09-20">Sep 20, 2026</time>. Values may have changed.
            </figcaption>
          </figure>
        </div>

        <ul className="grid w-full gap-7 border-t border-base/15 pt-8 sm:gap-8 sm:pt-10 lg:grid-cols-3 xl:gap-14">
          {FEATURES.map(({ title, description, Icon }) => (
            <li key={title} className="min-w-0">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-base/15 bg-primary-900 text-primary-300 [&_svg]:size-6"
                >
                  <Icon />
                </span>
                <h3 className="text-leading font-medium">{title}</h3>
              </div>
              <p className="mt-2.5 max-w-120 text-regular text-base/70">{description}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
