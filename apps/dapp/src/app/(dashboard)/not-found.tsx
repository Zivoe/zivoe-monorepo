'use client';

import { useRouter } from 'next/navigation';

import { Button } from '@zivoe/ui/core/button';
import { GlobeSecondaryIcon } from '@zivoe/ui/icons';

import Page from '@/components/page';

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <>
      <div className="h-[1px] bg-element-neutral-subtle" />

      <Page className="flex h-full items-center justify-center">
        <div className="w-full max-w-[33.75rem] rounded-2xl bg-surface-elevated p-2">
          <div className="flex flex-col items-center gap-4 rounded-xl bg-surface-base p-4 shadow-[0px_1px_6px_-2px_rgba(18,19,26,0.08)]">
            <div className="flex flex-col items-center gap-6 py-3">
              <div className="flex size-12 items-center justify-center rounded-md bg-element-alert-light">
                <GlobeSecondaryIcon className="size-8 text-alert-contrast" />
              </div>

              <div className="flex flex-col items-center gap-2">
                <p className="text-h5 text-primary">404 Error</p>
                <p className="text-regular text-secondary">Page not found</p>
              </div>
            </div>

            <Button fullWidth onPress={() => router.push('/')}>
              Go Home
            </Button>
          </div>
        </div>
      </Page>
    </>
  );
}
