import { type ReactNode } from 'react';

import NavigationSection from '@/components/navigation';

export default function InsightsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <div className="bg-surface-base lg:h-[5.75rem]">
        <NavigationSection />
      </div>
      {children}
    </>
  );
}
