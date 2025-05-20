import Link from 'next/link';

import { DocumentIcon, ExternalLinkIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { DepositInfoSection } from './common';

export default function Documents() {
  return (
    <DepositInfoSection title="Documents" icon={<DocumentIcon />}>
      <div>
        {Object.entries(LINKS).map(([title, href]) => (
          <DocumentLink key={title} title={title} href={href} className="border-b border-default last:border-b-0" />
        ))}
      </div>
    </DepositInfoSection>
  );
}

function DocumentLink({ title, href, className }: { title: string; href: string; className?: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      className={cn(
        'group flex items-center justify-between gap-4 px-2 py-3 hover:bg-element-neutral-light focus-visible:bg-element-neutral-subtle focus-visible:outline-none sm:px-3 sm:py-4',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className="size-2 rounded-full bg-element-primary-soft" />
        <p className="text-regular text-primary sm:text-leading">{title}</p>
      </div>

      <ExternalLinkIcon className="size-5 text-tertiary group-hover:text-primary group-focus-visible:text-primary" />
    </Link>
  );
}

const LINKS: Record<string, string> = {
  Prospectus: 'https://zivoe.com',
  'Reg S Compliance': 'https://zivoe.com',
  'Token Subscription Agreement': 'https://zivoe.com'
};
