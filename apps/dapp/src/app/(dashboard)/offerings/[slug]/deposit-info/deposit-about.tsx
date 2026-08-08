'use client';

import { type ReactNode, useState } from 'react';

import { Button } from '@zivoe/ui/core/button';
import { InfoIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import InfoSection from '@/components/info-section';

export default function DepositAbout({ paragraphs }: { paragraphs: Array<ReactNode> }) {
  const [showFullText, setShowFullText] = useState(false);

  return (
    <InfoSection title="About" icon={<InfoIcon />}>
      <div className="flex flex-col gap-2">
        <div className={cn('line-clamp-2 space-y-6', showFullText && 'line-clamp-none')}>
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="text-leading text-primary">
              {paragraph}
            </p>
          ))}
        </div>

        <Button variant="link-primary" size="m" onPress={() => setShowFullText(!showFullText)}>
          {showFullText ? 'Show Less' : 'Show More'}
        </Button>
      </div>
    </InfoSection>
  );
}
