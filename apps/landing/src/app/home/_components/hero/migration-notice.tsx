import { NextLink } from '@zivoe/ui/core/link';
import { ArrowRightIcon } from '@zivoe/ui/icons';

export default function MigrationNotice() {
  return (
    <aside
      aria-label="Platform migration status"
      className="border-secondary-200 border-l-secondary-600 bg-element-secondary-light mt-6 w-fit max-w-full rounded-xl border border-l-4 px-4 py-3 shadow-[0_8px_22px_rgba(18,19,26,0.05)] sm:px-5"
    >
      <p className="text-brand text-small font-medium">Platform migration: August 3–8</p>

      <div className="mt-1 flex flex-col gap-1.5 sm:flex-row sm:items-baseline sm:gap-5">
        <p className="text-secondary text-small">During this time, transactions will be temporarily paused.</p>

        <NextLink
          href="/migration-update"
          className="text-brand inline-flex w-fit items-center gap-1 text-small font-medium whitespace-nowrap hover:underline hover:underline-offset-4"
        >
          View migration update
          <ArrowRightIcon aria-hidden="true" className="size-4" />
        </NextLink>
      </div>
    </aside>
  );
}
