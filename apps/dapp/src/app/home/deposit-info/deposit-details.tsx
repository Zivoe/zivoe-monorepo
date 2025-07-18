import { ReactElement } from 'react';

import { Link } from '@zivoe/ui/core/link';
import { DocumentIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { DepositInfoSection } from './common';

export default function DepositDetails() {
  return (
    <DepositInfoSection title="Details" icon={<DocumentIcon />}>
      <div>
        {Object.entries(ELEMENTS).map(([title, value]) => (
          <Element key={title} title={title} value={value} className="border-b border-default last:border-b-0" />
        ))}
      </div>
    </DepositInfoSection>
  );
}

function Element({ title, value, className }: { title: string; value: string | ReactElement; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 px-2 py-3 sm:px-3 sm:py-4', className)}>
      <p className="text-small text-secondary sm:text-regular md:text-leading">{title}</p>
      {typeof value === 'string' ? (
        <p className="text-right text-small text-primary sm:text-regular md:text-leading">{value}</p>
      ) : (
        <>{value}</>
      )}
    </div>
  );
}

const ELEMENTS: Record<string, ReactElement | string> = {
  Eligibility: 'Institutions & Retail',
  'Underlying Assets': 'Non-Prime Consumer Loans',
  'Average Loan Size': '$2k - $10k',
  Geography: 'United States',
  'Legal Structure': 'Bankruptcy Remote SPV',
  'Regulatory Compliance': 'Reg S Compliant Offering',
  'Management Fee': '2.5% APR',
  Audits: (
    <Link
      href="https://docs.zivoe.com/official-links/audits"
      target="_blank"
      className="text-small sm:text-regular md:text-leading"
    >
      View Reports
    </Link>
  ),
  'Available Networks': 'Ethereum'
};
