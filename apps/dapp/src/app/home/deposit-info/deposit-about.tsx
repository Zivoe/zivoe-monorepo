'use client';

import { useState } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { InfoIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import InfoSection from '@/components/info-section';

export default function DepositAbout() {
  const [showFullText, setShowFullText] = useState(false);

  return (
    <InfoSection title="About" icon={<InfoIcon />}>
      <div className="flex flex-col gap-2">
        <div className={cn('line-clamp-2 space-y-6', showFullText && 'line-clamp-none')}>
          <p className="text-leading text-primary">
            zVLT offers qualified purchasers exposure to a professionally managed private credit portfolio—an asset
            class that has delivered strong, risk-adjusted returns to Wall Street investors for over 50 years. zVLT
            invests across several private credit verticals including consumer credit, merchant cash advance, and more.
          </p>

          <p className="text-leading text-primary">
            zVLT is a yield-bearing token, meaning that it delivers returns through price appreciation. As borrowers
            make interest payments, the underlying loan portfolio grows in value—reflected by a steadily increasing
            token price.
          </p>

          <p className="text-leading text-primary">
            zVLT delivers compelling yields that outperforms most stablecoin lending opportunities across the DeFi
            ecosystem. The strategy targets net annual returns of 14%-17% APY, supported by a team with decades of
            experience managing credit risk.
          </p>
        </div>

        <Button variant="link-primary" size="m" onPress={() => setShowFullText(!showFullText)}>
          {showFullText ? 'Show Less' : 'Show More'}
        </Button>
      </div>
    </InfoSection>
  );
}
