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
          zVLT offers qualified purchasers exposure to a diversified private credit portfolio—an asset class that 
          has delivered strong, risk-adjusted returns on Wall Street for decades. The portfolio is composed primarily of short-duration 
          credit instruments across several private credit verticals, including merchant cash advance, consumer credit, and more.
          </p>

          <p className="text-leading text-primary">
          zVLT is a yield-bearing token that delivers returns through price appreciation. As the underlying loan portfolio generates 
          income and grows in value, this is reflected by a steadily increasing token price.
          </p>

          <p className="text-leading text-primary">
          zVLT seeks to provide consistent, risk-adjusted yields supported by a diversified, short-duration strategy 
          and a team with decades of experience managing credit risk.
          </p>
        </div>

        <Button variant="link-primary" size="m" onPress={() => setShowFullText(!showFullText)}>
          {showFullText ? 'Show Less' : 'Show More'}
        </Button>
      </div>
    </InfoSection>
  );
}
