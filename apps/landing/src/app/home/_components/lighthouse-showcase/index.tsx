import { type SVGProps } from 'react';

import Image from 'next/image';

import styles from './lighthouse-showcase.module.css';

import { ChartIcon, PieChartIcon } from '@zivoe/ui/icons';

import { LighthouseMark } from '@/components/lighthouse-mark';

import { LighthouseCta } from '../hero/lighthouse-cta';

const features = [
  {
    title: 'View the portfolio',
    description: 'Explore portfolio composition and the breakdown of positions, cash, and other assets.',
    icon: PieChartIcon
  },
  {
    title: 'Understand the positions',
    description: 'Review reported performance, asset metrics, and historical trends for individual credit positions.',
    icon: ChartIcon
  },
  {
    title: 'Monitor liquidity',
    description: 'View available redemption reserves by network and stablecoin.',
    icon: LiquidityIcon
  }
];

// Isolated homepage experiment: remove this component's import and render to retire it.
export default function LighthouseShowcase() {
  return (
    <section id="lighthouse" aria-labelledby="lighthouse-heading" className={styles.section}>
      <div className={styles.container}>
        <div className={styles.showcase}>
          <div className={styles.introduction}>
            <div className={styles.brand}>
              <LighthouseMark className="size-11" />
              <span>Lighthouse</span>
            </div>
            <h2 id="lighthouse-heading" className={styles.heading}>
              A clearer view of private credit
            </h2>
            <p className={styles.description}>
              Explore the portfolio, balance sheet, and liquidity in real-time with Lighthouse.
            </p>
            <div className={styles.cta}>
              <LighthouseCta />
            </div>
          </div>

          <figure className={styles.preview}>
            <a
              href="https://lighthouse.zivoe.com/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Explore the Lighthouse dashboard (opens in a new tab)"
              aria-describedby="lighthouse-snapshot-caption"
              className={styles.previewLink}
            >
              <Image
                src="/lighthouse-dashboard-2026-09-20.webp"
                alt="Lighthouse zSMB dashboard showing reported and on-chain metrics, a portfolio composition chart, and a NAV breakdown of credit positions, cash, and other assets."
                width={1920}
                height={1355}
                unoptimized
                className={styles.image}
              />
            </a>
            <figcaption id="lighthouse-snapshot-caption" className={styles.caption}>
              Dashboard snapshot · <time dateTime="2026-09-20">Sep 20, 2026</time>. Values may have changed.
            </figcaption>
          </figure>
        </div>

        <ul className={styles.features}>
          {features.map(({ title, description, icon: Icon }) => (
            <li key={title} className={styles.feature}>
              <div className={styles.featureHeader}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <Icon width={24} height={24} />
                </span>
                <h3 className={styles.featureTitle}>{title}</h3>
              </div>
              <p className={styles.featureDescription}>{description}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// Match the viewer-facing Liquidity icon in the Lighthouse application.
function LiquidityIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 3c-2.5 3.5-7 7.4-7 11a7 7 0 0 0 14 0c0-3.6-4.5-7.5-7-11Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M8.5 14.5a3.5 3.5 0 0 0 3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
