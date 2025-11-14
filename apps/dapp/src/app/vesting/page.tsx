import Page from '@/components/page';

import VestingComponents from './_components';

export default function VestingPage() {
  return (
    <div className="bg-surface-base">
      <Page className="flex flex-col gap-10">
        <div className="space-y-2">
          <h1 className="text-h3 text-primary">Vesting</h1>
          <p className="text-regular text-secondary">
            Unlock your vested tokens gradually to ensure long-term commitment and stability.
          </p>
        </div>

        <VestingComponents />
      </Page>
    </div>
  );
}
