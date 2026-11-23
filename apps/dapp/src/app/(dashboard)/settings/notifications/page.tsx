import { type Metadata } from 'next';

import { verifyOnboarded } from '@/server/data/auth';
import { getEmailPreferences } from '@/server/data/email-preferences';

import EmailPreferencesForm from '@/app/unsubscribe/_components/email-preferences-form';

export const metadata: Metadata = { title: 'Notifications | Zivoe' };

/** The signed-in person's email preferences: the same form `/unsubscribe` shows an emailed link. Settings opens here. */
export default async function NotificationsPage() {
  const { user } = await verifyOnboarded();
  const preferences = await getEmailPreferences({ userId: user.id, email: user.email });

  return <EmailPreferencesForm initialPreferences={preferences} token={null} variant="settings" />;
}
