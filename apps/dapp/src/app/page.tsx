import { AppShell } from '@/components/app-shell';
import OnboardingGuard from '@/components/onboarding-guard';

import Home from './home';
import { depositPageViewSchema } from './home/deposit/_utils';

export default async function HomePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const params = await searchParams;
  const validatedView = depositPageViewSchema.safeParse(params.view);

  return (
    <>
      <AppShell>
        <Home initialView={validatedView.success ? validatedView.data : null} />
      </AppShell>

      <OnboardingGuard />
    </>
  );
}
