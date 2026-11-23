import { type Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { getRequiredStep, getUser } from '@/server/data/auth';
import { organizations } from '@/server/organizations';

import { withNext } from '@/lib/lighthouse';
import { isInvitationPath } from '@/lib/return-paths';

import { InvitationView } from './_components/invitation-view';

export const metadata: Metadata = { title: 'Invitation | Zivoe' };

/**
 * Where an invitation email leads. A visitor with no session signs in or signs
 * up first, with the address the link carries prefilled, and lands back here,
 * already onboarded, skipping "How will you invest?": the link is the answer, and
 * nothing about the invitation shows before then. Signed in, the page reads `viewForInvitee`: an invitee who already joined goes to the organization's members.
 */
export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const path = `/invitations/${id}`;
  if (!isInvitationPath(path)) notFound();

  const { user } = await getUser();
  if (!user) redirect(withNext('/sign-in', path));

  const step = await getRequiredStep(user.id);
  if (step) redirect(withNext(step, path));

  const view = await organizations.viewForInvitee({ invitationId: id, userId: user.id });
  // The invitee's second click on the link once in: there already.
  if (view.status === 'member') redirect(`/settings/organizations/${view.organizationId}/members`);

  return (
    <div className="flex h-full flex-col items-center">
      <InvitationView invitationId={id} view={view} email={user.email} path={path} />
    </div>
  );
}
