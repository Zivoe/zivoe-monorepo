import type { ReactNode } from 'react';

import { redirect } from 'next/navigation';

import { ZivoeLogo } from '@zivoe/ui/assets/zivoe-logo';
import { Link, NextLink } from '@zivoe/ui/core/link';

import {
  type EmailPreferences,
  getAppEmailPreferences,
  resolveUnsubscribeActor
} from '@/server/data/email-preferences';
import { getBeehiivNewsletterPreference } from '@/server/utils/beehiiv';

import { handlePromise } from '@/lib/utils';
import { EMAILS } from '@/lib/utils';

import Footer from '@/app/(dashboard)/_components/footer';
import EmailPreferencesForm from '@/app/unsubscribe/_components/email-preferences-form';
import UnsubscribeHeaderPattern from '@/app/unsubscribe/_components/unsubscribe-header-pattern';

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;
  const actorResult = await resolveUnsubscribeActor({ token });

  if (actorResult.status === 'unauthorized') redirect('/sign-in');

  if (actorResult.status === 'invalid_token') {
    return (
      <ManageNotificationsLayout description="This unsubscribe link is invalid or has expired.">
        <div className="mx-auto max-w-[39.375rem] rounded-2xl bg-surface-elevated p-2">
          <div className="rounded-xl bg-surface-base p-6 shadow-sm md:p-8">
            <p className="text-regular text-primary">
              Open a newer Zivoe email to use its unsubscribe link, or sign in to manage your email preferences
              directly.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link variant="primary" href="/sign-in">
                Sign in
              </Link>

              <Link variant="ghost-light" href={`mailto:${EMAILS.INVESTORS}`}>
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </ManageNotificationsLayout>
    );
  }

  const actor = actorResult.actor;
  const [{ res: appPreferences, err: appPreferencesErr }, { res: newsletterPreference, err: newsletterPreferenceErr }] =
    await Promise.all([
      handlePromise(getAppEmailPreferences({ userId: actor.userId })),
      handlePromise(getBeehiivNewsletterPreference(actor.email))
    ]);

  if (appPreferencesErr || !appPreferences || newsletterPreferenceErr) {
    const cause = appPreferencesErr ?? newsletterPreferenceErr;
    throw new Error('Failed to load email preferences.', cause ? { cause } : undefined);
  }

  const preferences: EmailPreferences = {
    ...appPreferences,
    newsletter: newsletterPreference ?? null
  };

  return (
    <ManageNotificationsLayout description="Choose the emails you'd like to receive from Zivoe. You can update your preferences anytime you'd like.">
      <EmailPreferencesForm initialPreferences={preferences} token={token} />
    </ManageNotificationsLayout>
  );
}

function ManageNotificationsLayout({ description, children }: { description: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-base">
      <header className="relative overflow-hidden border-b border-subtle bg-element-tertiary px-6 pb-14 pt-8 md:min-h-[25rem] md:px-10 md:pb-[9.5625rem] md:pt-12">
        <UnsubscribeHeaderPattern />

        <div className="relative z-10">
          <NextLink href="/">
            <ZivoeLogo className="h-8 text-base md:h-10" />
          </NextLink>

          <div className="mt-10 flex flex-col items-center text-center md:mt-12">
            <h1 className="text-h3 text-brand">Manage Notifications</h1>
            <p className="mt-3 max-w-[500px] text-leading text-brand">{description}</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 -mt-6 flex-1 px-4 sm:-mt-8 md:-mt-[4.5rem] md:px-10">{children}</main>

      <Footer />
    </div>
  );
}
