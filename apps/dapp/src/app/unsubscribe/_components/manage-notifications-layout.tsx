import type { ReactNode } from 'react';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { NextLink } from '@zivoe/ui/core/link';

import Footer from '@/app/(dashboard)/_components/footer';

import UnsubscribeHeaderPattern from './unsubscribe-header-pattern';

/** The `/unsubscribe` shell — header, description and footer — shared by the page and its `loading.tsx`. */
export default function ManageNotificationsLayout({
  description,
  children
}: {
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      {/* `shrink-0`: on a short viewport the column would otherwise squeeze the header and clip its description. */}
      <header className="relative shrink-0 overflow-hidden border-b border-subtle bg-element-tertiary px-6 pt-8 pb-14 md:min-h-100 md:px-10 md:pt-12 md:pb-38.25">
        <UnsubscribeHeaderPattern />

        <div className="relative z-10">
          <NextLink href="/" aria-label="Zivoe home">
            <ZivoeLogo aria-hidden="true" className="h-8 text-base md:h-10" />
          </NextLink>

          <div className="mt-10 flex flex-col items-center text-center md:mt-12">
            <h1 className="text-h3 text-brand">Manage Notifications</h1>
            <p className="mt-3 w-full max-w-125 text-leading text-brand">{description}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 -mt-6 flex-1 px-4 sm:-mt-8 md:-mt-18 md:px-10">{children}</main>

      <Footer />
    </div>
  );
}
