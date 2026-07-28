import { redirect } from 'next/navigation';

/** The bare prefix has nothing of its own to show — send it to the entry point. */
export default function OpportunitiesRedirectPage() {
  redirect('/');
}
