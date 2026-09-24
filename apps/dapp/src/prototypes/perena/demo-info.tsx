import { type ReactNode } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { Separator } from '@zivoe/ui/core/separator';
import { BankIcon, DiamondIcon, DocumentIcon, MoneyIcon, TrendingIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import InfoSection from '@/components/info-section';

import DepositAbout from '@/app/(dashboard)/vaults/[slug]/deposit-info/deposit-about';
import DepositContact from '@/app/(dashboard)/vaults/[slug]/deposit-info/deposit-contact';
import Documents from '@/app/(dashboard)/vaults/[slug]/deposit-info/deposit-documents';

import { PERENA_DEMO } from './config';
import { SampleChart } from './sample-chart';
import { type DemoTransaction, formatDemoAmount } from './state';

const USER_DOCS = `${PERENA_DEMO.docsUrl}/for-users`;
const ABOUT = [
  'A proposed Zivoe-managed USDC lending strategy using Perena V2 on Solana. Deposits would fund lending activity, with ordinary vault shares representing a proportional interest in the portfolio.',
  'This prototype explores the depositor experience with Perena V2 as the proposed vault infrastructure. It uses ordinary, untranched shares: there are no senior or junior tranches in this demo.',
  'The demo exchanges 1 USDC for 1 vault share, charges no simulated fees, and settles redemptions immediately. Actual pricing, fees, and redemption availability would depend on the eventual vault configuration and liquidity. All balances and activity here are simulated.'
];
const DETAILS = [
  ['Proposed manager', 'Zivoe'],
  ['Asset', 'USDC'],
  ['Proposed network', 'Solana'],
  ['Proposed infrastructure', 'Perena V2'],
  ['Share structure', 'Ordinary · Untranched'],
  ['Demo share price', '$1.00 · Fixed'],
  ['Simulated fees', '$0.00'],
  ['Demo redemptions', 'Immediate · Simulated']
];

export function DemoInfo({ activity }: { activity: Array<DemoTransaction> }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-8 lg:gap-10">
      <SampleChart />
      <DiamondSeparator />
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap justify-between gap-6">
          <Metric
            icon={<BankIcon />}
            label="Illustrative NAV"
            value={`$${PERENA_DEMO.sampleNav.toLocaleString('en-US')}`}
          />
          <Metric icon={<TrendingIcon />} label="Illustrative APY" value={`${PERENA_DEMO.sampleApy}%`} />
          <Metric icon={<MoneyIcon />} label="Demo share price" value="$1.00" />
        </div>
        <p className="text-small text-tertiary">
          Sample data, not Perena product terms. NAV and APY are illustrative; the fixed demo price does not accrue
          yield.
        </p>
        <ul role="list" aria-label="Highlights" className="@container flex flex-col gap-3">
          <Highlight
            icon={<BankIcon />}
            title="Perena V2 infrastructure"
            description="A proposed vault built on Perena V2, with USDC as the demo asset on Solana."
            fact="Perena V2"
            factLabel="Proposed infrastructure"
            href={PERENA_DEMO.docsUrl}
            action="View overview"
            className="bg-element-primary-light"
          />
          <Highlight
            icon={<MoneyIcon />}
            title="Simulated redemption liquidity"
            description="Try redeeming shares back to USDC. Actual availability would depend on configuration and liquidity."
            fact="Immediate"
            factLabel="In this simulation"
            href={USER_DOCS}
            action="Read about exits"
            className="bg-element-tertiary-gentle"
          />
          <Highlight
            icon={<DocumentIcon />}
            title="Ordinary vault shares"
            description="Proportional exposure to the proposed lending portfolio, with no senior or junior tranches in this demo."
            fact="Untranched"
            factLabel="Demo share structure"
            href={USER_DOCS}
            action="Explore shares"
            className="bg-element-secondary-light"
          />
        </ul>
      </div>
      <DiamondSeparator />
      <DepositAbout paragraphs={ABOUT} />
      <DiamondSeparator />
      <InfoSection title="Details" icon={<DocumentIcon />}>
        <dl>
          {DETAILS.map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between gap-4 border-b border-default px-2 py-3 text-small last:border-b-0 sm:px-3 sm:py-4 sm:text-regular md:text-leading"
            >
              <dt className="text-secondary">{label}</dt>
              <dd className="text-right text-primary">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-small text-tertiary">
          Actual redemption availability would depend on vault configuration and liquidity.
        </p>
      </InfoSection>
      <DiamondSeparator />
      <Documents
        documents={[
          { title: 'Perena V2 overview', href: PERENA_DEMO.docsUrl },
          { title: 'Perena V2 user documentation', href: USER_DOCS }
        ]}
      />
      <DiamondSeparator />
      <DepositContact />
      <DiamondSeparator />
      <InfoSection title="Demo activity" icon={<DocumentIcon />}>
        <p className="text-small text-secondary">Local to this browser tab. Reset demo clears balances and activity.</p>
        {activity.length ? (
          <ol className="divide-y divide-default">
            {activity.map((tx) => (
              <li key={tx.id} className="flex flex-wrap items-center justify-between gap-2 px-2 py-3">
                <div>
                  <p className="text-small font-medium text-primary">
                    {tx.kind === 'deposit' ? 'Deposit' : 'Redemption'} simulated
                  </p>
                  <time dateTime={tx.at} className="text-extraSmall text-tertiary">
                    {new Date(tx.at).toLocaleString()}
                  </time>
                </div>
                <p className="text-small text-primary">{formatDemoAmount(tx.amount)} USDC</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-small text-tertiary">Your simulated deposits and redemptions will appear here.</p>
        )}
      </InfoSection>
    </div>
  );
}

function DiamondSeparator() {
  return (
    <Separator>
      <DiamondIcon className="size-3 text-neutral-300" />
    </Separator>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex shrink-0 flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="[&_svg]:size-5 [&_svg]:text-secondary-contrast">{icon}</span>
        <p className="text-regular whitespace-nowrap text-secondary">{label}</p>
      </div>
      <p className="font-heading! text-h6 whitespace-nowrap text-primary xl:text-h5">{value}</p>
    </div>
  );
}

function Highlight({
  icon,
  title,
  description,
  fact,
  factLabel,
  href,
  action,
  className
}: {
  icon: ReactNode;
  title: string;
  description: string;
  fact: string;
  factLabel: string;
  href: string;
  action: string;
  className: string;
}) {
  return (
    <li className={cn('flex flex-col gap-3 rounded-xl p-4 @2xl:flex-row @2xl:items-center @2xl:gap-6', className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden="true"
          className="flex w-12 shrink-0 items-center justify-center text-primary [&_svg]:h-8 [&_svg]:w-auto"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-regular font-medium text-primary">{title}</p>
          <p className="text-small text-secondary">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-default pt-3 @2xl:w-84 @2xl:shrink-0 @2xl:border-t-0 @2xl:border-l @2xl:pt-0 @2xl:pl-6">
        <div className="min-w-0">
          <p className="text-regular font-medium text-primary">{fact}</p>
          <p className="text-extraSmall text-secondary">{factLabel}</p>
        </div>
        <Link variant="border" size="s" href={href} target="_blank" className="shrink-0">
          {action}
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
      </div>
    </li>
  );
}
