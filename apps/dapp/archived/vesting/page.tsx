import Page from '@/components/page';

import { OnboardingGuard } from '../_components/onboarding-guard';
import VestingComponents from './_components';

export default function VestingPage() {
  return (
    <>
      <OnboardingGuard />

      <div className="bg-surface-base">
        <Page className="flex flex-col gap-6 lg:gap-10">
          <div className="space-y-2">
            <h1 className="text-h3 text-primary">Vesting</h1>
            <p className="text-regular text-secondary">Manage your ZVE vesting schedule.</p>
          </div>

          <VestingComponents />
        </Page>
      </div>
    </>
  );
}
