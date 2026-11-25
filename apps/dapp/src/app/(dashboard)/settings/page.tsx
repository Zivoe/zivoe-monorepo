import { redirect } from 'next/navigation';

/** Settings opens on its first page. */
export default function SettingsPage() {
  redirect('/settings/notifications');
}
