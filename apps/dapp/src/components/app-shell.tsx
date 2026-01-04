import { type ReactNode } from 'react';

import ChainalysisAssessmentDialog from '@/app/_components/chainalysis-assessment-dialog';
import Footer from '@/app/_components/footer';
import Header from '@/app/_components/header';

interface AppShellProps {
  children: ReactNode;
}

// TODO: optimization -Refactor this into a separate (app) layout
export function AppShell({ children }: AppShellProps) {
  return (
    <>
      <Header />

      <div className="flex h-full flex-col justify-between bg-surface-base">
        {children}
        <Footer />
      </div>

      <ChainalysisAssessmentDialog />
    </>
  );
}
