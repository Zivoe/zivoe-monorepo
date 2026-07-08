import { NextLink } from '@zivoe/ui/core/link';
import { DocumentIcon, ExternalLinkIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import InfoSection from '@/components/info-section';

export default function Documents() {
  return (
    <InfoSection title="Documents" icon={<DocumentIcon />}>
      <div>
        {Object.entries(LINKS).map(([title, href]) => (
          <DocumentLink key={title} title={title} href={href} className="border-default border-b last:border-b-0" />
        ))}
      </div>
    </InfoSection>
  );
}

function DocumentLink({ title, href, className }: { title: string; href: string; className?: string }) {
  return (
    <NextLink
      href={href}
      target="_blank"
      className={cn(
        'group hover:bg-element-neutral-light focus-visible:bg-element-neutral-subtle flex items-center justify-between gap-4 px-2 py-3 focus-visible:outline-hidden sm:px-3 sm:py-4',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="bg-element-primary-soft size-2 rounded-full" />
        <p className="text-regular text-primary sm:text-leading">{title}</p>
      </div>

      <ExternalLinkIcon className="text-tertiary group-hover:text-primary group-focus-visible:text-primary size-5" />
    </NextLink>
  );
}

const LINKS: Record<string, string> = {
  'Protocol Documentation': 'https://docs.zivoe.com/user-docs/introduction',
  'Reg S Compliance': 'https://docs.zivoe.com/terms/reg-s-compliance'
};
