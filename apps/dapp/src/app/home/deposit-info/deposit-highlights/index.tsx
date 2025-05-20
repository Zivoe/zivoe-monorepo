import { ReactNode } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { Link } from '@zivoe/ui/core/link';
import { StarIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { DepositInfoSection } from '../common';
import { AutocompoundingIcon } from './autocompounding-icon';
import { ExperienceIcon } from './experience-icon';
import { LiquidityIcon } from './liquidity-icon';

export default function DepositHighlights() {
  return (
    <DepositInfoSection title="Highlights" icon={<StarIcon />}>
      <div className="flex flex-col gap-3">
        <Card
          icon={<LiquidityIcon />}
          title="24/7 Liquidity"
          description="The Zivoe Credit Fund (zVLT) offers qualified purchasers exposure to a diversified portfolio of nonprime consumer loans with 24/7 liquidity via secondary markets."
          className="bg-element-primary-gentle"
        >
          {/* <div className="flex gap-2">
            <Link variant="primary" size="m" href="/swap" hideExternalLinkIcon>
              Swap
            </Link>

            <Link variant="border" size="m" href="https://google.com">
              View Pool on Curve
            </Link>
          </div> */}
        </Card>

        <Card
          icon={<AutocompoundingIcon />}
          title="Autocompounding"
          description="zveUSD is a yield-bearing token, meaning it automatically increases in value as interest is generated. Interest is automatically compounded to maximize growth."
          className="bg-element-secondary-light"
        />

        <Card
          icon={<ExperienceIcon />}
          title="Decades of Experience"
          description="Our team has over 40 years of combined experience managing loan portfolios at leading financial institutions and DeFi protocols including JP Morgan Chase, Wells Fargo, and Maple Finance."
          className="bg-tertiary-100"
        >
          <Link variant="border" size="m" href="https://www.zivoe.com/about-us">
            Meet the Team
          </Link>
        </Card>
      </div>
    </DepositInfoSection>
  );
}

function Card({
  icon,
  title,
  description,
  children,
  className
}: {
  icon: ReactNode;
  title: string;
  description: string;
  className: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-4 rounded-xl p-6', className)}>
      <div className="flex flex-col gap-6">
        {icon}
        <p className="text-smallSubheading text-primary">{title}</p>
      </div>

      <p className="text-leading text-primary">{description}</p>

      {children}
    </div>
  );
}
