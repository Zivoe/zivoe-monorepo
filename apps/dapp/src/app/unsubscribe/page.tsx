import { redirect } from 'next/navigation';

import { Link } from '@zivoe/ui/core/link';

import { getUser } from '@/server/data/auth';
import { getEmailPreferences, resolveUnsubscribeActor } from '@/server/data/email-preferences';

import { handlePromise } from '@/lib/utils';
import { EMAILS } from '@/lib/utils';

import EmailPreferencesForm from '@/app/unsubscribe/_components/email-preferences-form';
import ManageNotificationsLayout from '@/app/unsubscribe/_components/manage-notifications-layout';

/**
 * Where an email's unsubscribe link lands, with or without a session: the token alone says whose preferences
 * these are, and it wins over a session, so a forwarded email never edits whoever happens to be signed in.
 * Without a token this is Settings → Notifications, which needs a session.
 */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  const token = typeof params.token === 'string' ? params.token : null;

  if (!token) redirect((await getUser()).user ? '/settings/notifications' : '/sign-in');

  const actorResult = await resolveUnsubscribeActor({ token });

  // With a token the answer is the token's: authorized, or not valid.
  if (actorResult.status !== 'authorized') {
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

  const { res: preferences, err } = await handlePromise(
    getEmailPreferences({ userId: actorResult.actor.userId, email: actorResult.actor.email })
  );
  if (err || !preferences) throw new Error('Failed to load email preferences.', err ? { cause: err } : undefined);

  return (
    <ManageNotificationsLayout description="Choose the emails you'd like to receive from Zivoe. You can update your preferences anytime you'd like.">
      <EmailPreferencesForm initialPreferences={preferences} token={token} />
    </ManageNotificationsLayout>
  );
}
