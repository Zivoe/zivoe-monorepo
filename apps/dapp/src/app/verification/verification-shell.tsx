import { type ReactNode } from 'react';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Link } from '@zivoe/ui/core/link';
import { Separator } from '@zivoe/ui/core/separator';
import { CloseIcon } from '@zivoe/ui/icons';

import { EMAILS } from '@/lib/emails';

import { Auth } from '@/app/(auth)/_components/common';

/**
 * The `/verification` chrome — sidebar, Exit and help line — shared by
 * `VerificationFlow` and the route's `loading.tsx`, so the two cannot drift.
 * `rail` goes in the desktop sidebar, `mobileRail` above the content below
 * `lg`; `children` is the step's content column.
 */
export default function VerificationShell({
  rail,
  mobileRail,
  children
}: {
  rail: ReactNode;
  mobileRail: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh shrink-0 flex-col bg-surface-base lg:flex-row lg:gap-3 lg:p-4">
      {/* The shell grows with its content; the rail stretches to the full page height. */}
      <aside className="hidden shrink-0 flex-col rounded-xl bg-element-tertiary p-8 lg:flex lg:w-80 xl:w-96 xl:p-10">
        <ZivoeLogo aria-hidden="true" className="h-8 w-auto self-start" />

        <div className="mt-14">{rail}</div>

        <p className="mt-auto text-small text-secondary">
          For questions, email{' '}
          <Link href={`mailto:${EMAILS.INQUIRE}`} variant="link-neutral-dark" size="s">
            {EMAILS.INQUIRE}
          </Link>
        </p>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex min-h-25 items-center justify-between px-6 lg:min-h-20 lg:px-10">
          <ZivoeLogo aria-hidden="true" className="w-[5.3rem] lg:hidden" />

          <div className="ml-auto flex items-center gap-1">
            <Link variant="ghost-light" size="m" href="/">
              Exit
              <CloseIcon aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className="lg:hidden">
          <Separator />
          <div className="px-6 pt-6">{mobileRail}</div>
        </div>

        <main className="flex flex-1 flex-col items-center px-6">
          {children}

          <div className="lg:hidden">
            <Auth.HelpFooter />
          </div>
        </main>
      </div>
    </div>
  );
}
