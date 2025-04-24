import { cn } from '@zivoe/ui/lib/tw-utils';

export default function NewsletterHeader({
  className,
  type = 'dark'
}: {
  className?: string;
  type?: 'dark' | 'light';
}) {
  return (
    <div className={cn('flex flex-col items-start gap-2 sm:items-center sm:gap-4 xl:gap-6', className)}>
      <p className={cn('!font-heading text-h5 sm:text-h2', type === 'dark' ? 'text-primary' : 'text-base')}>
        Join Our Newsletter
      </p>

      <p className={cn('text-regular sm:text-smallSubheading', type === 'dark' ? 'text-secondary' : 'text-base')}>
        Receive news and opportunities straight to your inbox
      </p>
    </div>
  );
}
