import { redirect } from 'next/navigation';

import { Link } from '@zivoe/ui/core/link';

import {
  type EmailPreferences,
  getAppEmailPreferences,
  resolveUnsubscribeActor
} from '@/server/data/email-preferences';
import { getBeehiivNewsletterPreference } from '@/server/utils/beehiiv';

import { handlePromise } from '@/lib/utils';
import { EMAILS } from '@/lib/utils';

import EmailPreferencesForm from '@/app/unsubscribe/_components/email-preferences-form';
import ManageNotificationsLayout from '@/app/unsubscribe/_components/manage-notifications-layout';

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;
  const actorResult = await resolveUnsubscribeActor({ token });

  if (actorResult.status === 'unauthorized') redirect('/sign-in');

  if (actorResult.status === 'invalid_token') {
    return (
      <ManageNotificationsLayout description="This unsubscribe link is invalid or has expired.">
        <div className="mx-auto max-w-157.5 rounded-2xl bg-surface-elevated p-2">
          <div className="rounded-xl bg-surface-base p-6 shadow-xs md:p-8">
            <p className="text-regular text-primary">
              Open a newer Zivoe email to use its unsubscribe link, or sign in to manage your email preferences
              directly.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link variant="primary" href="/sign-in">
                Sign in
              </Link>

              <Link variant="ghost-light" href={`mailto:${EMAILS.INQUIRE}`}>
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
