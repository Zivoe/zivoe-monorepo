import { Link } from '@zivoe/ui/core/link';
import { InfoIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

const MIGRATION_UPDATE_URL = 'https://www.zivoe.com/migration-update';

export default function MigrationNotice({ type }: { type: 'desktop' | 'mobile' }) {
  const isDesktop = type === 'desktop';

  return (
    <div className={cn(isDesktop ? 'mt-5 hidden lg:block' : 'flex justify-end lg:hidden')}>
      <div
        className={cn(
          'bg-element-warning-light text-warning flex rounded-md',
          isDesktop ? 'gap-3 px-6 py-4' : 'gap-2 p-1.5'
        )}
      >
        <InfoIcon className={cn('shrink-0', isDesktop ? 'size-6' : 'size-4')} />

        <div className={cn('flex flex-col items-start', isDesktop && 'gap-1')}>
          <p className={cn('font-medium', isDesktop ? 'text-leading' : 'text-small')}>
            Deposits and redemptions are disabled as we migrate to Centrifuge
          </p>

          <Link
            variant="link-neutral-dark"
            size={isDesktop ? undefined : 's'}
            className={cn(
              'text-warning-subtle underline hover:no-underline',
              isDesktop ? 'text-regular underline-offset-8' : 'underline-offset-4'
            )}
            href={MIGRATION_UPDATE_URL}
            target="_blank"
          >
            View migration update
          </Link>
        </div>
      </div>
    </div>
  );
}
