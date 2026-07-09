import { type ReactNode } from 'react';

import NavigationSection from '@/components/navigation';

export default function InsightsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="bg-surface-base lg:h-23">
        <NavigationSection />
      </div>
      {children}
    </>
  );
}
