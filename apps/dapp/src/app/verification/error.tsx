'use client';

import { startTransition, useEffect } from 'react';

import { useRouter } from 'next/navigation';

import * as Sentry from '@sentry/nextjs';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Button } from '@zivoe/ui/core/button';
import { Link } from '@zivoe/ui/core/link';
import { CloseIcon } from '@zivoe/ui/icons';

import { EMAILS } from '@/lib/emails';

/** Replaces the whole `/verification` shell, so it carries its own way out: Exit and the support address. */
export default function VerificationError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();

  useEffect(() => {
    Sentry.captureException(error, { tags: { source: 'VERIFICATION' } });
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-surface-base">
      <header className="flex min-h-25 items-center justify-between px-6 lg:min-h-20 lg:px-10">
        <ZivoeLogo aria-hidden="true" className="w-[5.3rem]" />

        <Link variant="ghost-light" size="m" href="/">
          Exit
          <CloseIcon aria-hidden="true" />
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-h4 text-primary">Something went wrong</h2>
        <p className="max-w-md text-regular text-secondary">
          Try again, or email{' '}
          <Link href={`mailto:${EMAILS.INQUIRE}`} variant="link-neutral-dark" size="m">
            {EMAILS.INQUIRE}
          </Link>{' '}
          if this keeps happening.
        </p>
        <Button
          onPress={() =>
            startTransition(() => {
              router.refresh();
              reset();
            })
          }
        >
          Try again
        </Button>
      </main>
    </div>
  );
}
