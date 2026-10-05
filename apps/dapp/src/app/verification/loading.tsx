import { Skeleton } from '@zivoe/ui/core/skeleton';

import LoadingStatus from '@/components/loading-status';
import TextSkeleton from '@/components/text-skeleton';

import VerificationShell from './verification-shell';
import { VERIFICATION_STEPS } from './verification-steps';

/**
 * `VerificationFlow` while the page's data is on its way, in the same shell.
 * Which step is current or done is the record's call, so the rail pulses.
 *
 * The content stands in for the identity step, the one every investor with an
 * inquiry lands on: its description's line count, a status card, and below
 * `lg` the row with the label on the second step.
 */
export default function VerificationLoading() {
  return (
    <VerificationShell
      rail={
        <div className="flex flex-col">
          {VERIFICATION_STEPS.map((step, index) => (
            <div key={step.id} className="flex flex-col">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-md bg-neutral-900/10" />
                <span className="text-regular">
                  <TextSkeleton className="w-32 bg-neutral-900/10" />
                </span>
              </div>

              {index < VERIFICATION_STEPS.length - 1 ? <span className="my-1.5 ml-4 h-6 w-px bg-tertiary-600" /> : null}
            </div>
          ))}
        </div>
      }
      mobileRail={
        <div className="flex items-center gap-3">
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <span className="h-px w-4 bg-tertiary-600" />
          <Skeleton className="size-7 shrink-0 rounded-md" />
          <span className="text-small">
            <TextSkeleton className="w-28" />
          </span>
        </div>
      }
    >
      <div className="flex w-full max-w-2xl flex-1 flex-col">
        <LoadingStatus />

        <div className="min-h-11 flex-1" />

        <div className="flex w-full flex-col gap-11">
          {/* Auth.Header: step indicator, title, description. */}
          <div className="flex w-full flex-col gap-10">
            <span className="text-leading">
              <TextSkeleton className="w-24" />
            </span>

            <div className="flex flex-col gap-4">
              <p className="text-h5">
                <TextSkeleton className="w-72 max-w-full" />
              </p>
              <p className="text-regular">
                <TextSkeleton className="w-full" />
                <TextSkeleton className="w-full sm:hidden" />
                <TextSkeleton className="w-full sm:hidden" />
                <TextSkeleton className="w-2/3" />
              </p>
            </div>
          </div>

          <Skeleton className="h-14 w-full rounded-xl" />
        </div>

        <div className="min-h-6 flex-1" />
      </div>
    </VerificationShell>
  );
}
