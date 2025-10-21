import { ReactNode } from 'react';

import { DollarIcon, GlobeIcon, LineChartIcon, TrendingIcon } from '@zivoe/ui/icons';

export default function LoanCard({
  image,
  title,
  description,
  info,
  investmentValue,
  interestEarned,
  averageLoanSize,
  geography
}: {
  image: ReactNode;
  title: string;
  description: string;
  info: string;
  investmentValue: string;
  interestEarned: string;
  averageLoanSize: string;
  geography: string;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {image}

        <div>
          <h3 className="text-leading text-primary">{title}</h3>
          <p className="text-regular text-tertiary">{description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-regular text-primary">Deal Info</p>
        <p className="text-regular text-secondary">{info}</p>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-regular text-primary">Performance</p>

        <div className="grid gap-2 sm:grid-cols-2">
          <PerformanceCard
            label="Investment Value"
            value={investmentValue}
            icon={<DollarIcon className="size-5 text-icon-default" />}
          />
          <PerformanceCard
            label="Interest Earned"
            value={interestEarned}
            icon={<TrendingIcon className="size-5 text-icon-default" />}
          />
          <PerformanceCard
            label="Average Loan Size"
            value={averageLoanSize}
            icon={<LineChartIcon className="size-5 text-icon-default" />}
          />
          <PerformanceCard
            label="Geography"
            value={geography}
            icon={<GlobeIcon className="size-5 text-icon-default" />}
          />
        </div>
      </div>
    </div>
  );
}

function PerformanceCard({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-default px-4 py-3">
      <div className="flex size-8 items-center justify-center rounded-md bg-surface-elevated-low-emphasis">{icon}</div>

      <div>
        <p className="text-small text-secondary">{label}</p>
        <p className="text-regular text-primary">{value}</p>
      </div>
    </div>
  );
}
