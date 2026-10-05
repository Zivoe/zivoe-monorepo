import { NextLink } from '@zivoe/ui/core/link';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { DocumentIcon, ExternalLinkIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import InfoSection from '@/components/info-section';
import TextSkeleton from '@/components/text-skeleton';

import { type ZivoeVault } from '@/zivoe-vaults';

export default function Documents({ documents }: { documents: ZivoeVault['documents'] }) {
  return (
    <InfoSection title="Documents" icon={<DocumentIcon />}>
      <div>
        {documents.map(({ title, href }) => (
          <DocumentLink key={title} title={title} href={href} className="border-b border-default last:border-b-0" />
        ))}
      </div>
    </InfoSection>
  );
}

/** One pulsing row while the page's data is on its way; the documents are the Zivoe Vault's own. */
export function DocumentsSkeleton() {
  return (
    <InfoSection title="Documents" icon={<DocumentIcon />}>
      <div className={ROW_LAYOUT}>
        <div className="flex items-center gap-3">
          <Skeleton className="size-2 rounded-full" />
          <p className="text-regular sm:text-leading">
            <TextSkeleton className="w-36" />
          </p>
        </div>

        <Skeleton className="size-5 rounded-sm" />
      </div>
    </InfoSection>
  );
}

const ROW_LAYOUT = 'flex items-center justify-between gap-4 px-2 py-3 sm:px-3 sm:py-4';

function DocumentLink({ title, href, className }: { title: string; href: string; className?: string }) {
  return (
    <NextLink
      href={href}
      target="_blank"
      className={cn(
        ROW_LAYOUT,
        'group hover:bg-element-neutral-light focus-visible:bg-element-neutral-subtle focus-visible:outline-hidden',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="size-2 rounded-full bg-element-primary-soft" />
        <p className="text-regular text-primary sm:text-leading">{title}</p>
      </div>

      <ExternalLinkIcon className="size-5 text-tertiary group-hover:text-primary group-focus-visible:text-primary" />
    </NextLink>
  );
}
