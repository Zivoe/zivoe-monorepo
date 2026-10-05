import { Skeleton } from '@zivoe/ui/core/skeleton';

import LoadingStatus from '@/components/loading-status';
import TextSkeleton from '@/components/text-skeleton';

import ManageNotificationsLayout from '@/app/unsubscribe/_components/manage-notifications-layout';

export default function UnsubscribeLoading() {
  return (
    <ManageNotificationsLayout
      description={
        <>
          <TextSkeleton className="w-full bg-neutral-900/10" />
          <TextSkeleton className="w-full bg-neutral-900/10 sm:hidden" />
          <TextSkeleton className="w-3/5 bg-neutral-900/10" />
        </>
      }
    >
      {/* EmailPreferencesForm: three preference rows, Save, and the note under the card. */}
      <div className="mx-auto max-w-157.5">
        <LoadingStatus />

        <div className="rounded-2xl bg-surface-elevated p-2">
          <div className="rounded-xl bg-surface-base p-4 shadow-xs">
            <div className="flex flex-col">
              {/* The first and last descriptions run to a second line below `sm`. */}
              {[
                { title: 'w-44', wraps: true },
                { title: 'w-28', wraps: false },
                { title: 'w-24', wraps: true }
              ].map(({ title, wraps }, index) => (
                <div key={title}>
                  <div className="flex items-center justify-between gap-4 py-4">
                    <div className="flex-1">
                      <p className="text-leading">
                        <TextSkeleton className={title} />
                      </p>
                      <p className="text-small">
                        <TextSkeleton className={wraps ? 'w-full sm:w-3/5' : 'w-3/5'} />
                        {wraps && <TextSkeleton className="w-2/5 sm:hidden" />}
                      </p>
                    </div>
                    <Skeleton className="h-7 w-12 rounded-full" />
                  </div>
                  {index < 2 && <div className="border-t border-default" />}
                </div>
              ))}

              <div className="pt-4">
                <Skeleton className="h-12 w-full rounded-sm" />
              </div>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-100 text-center text-small">
          <TextSkeleton className="w-full" />
          <TextSkeleton className="w-3/5" />
        </p>
      </div>
    </ManageNotificationsLayout>
  );
}
