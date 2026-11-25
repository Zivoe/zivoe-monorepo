import { type Metadata } from 'next';
import { notFound } from 'next/navigation';

import { verifyOnboarded } from '@/server/data/auth';
import { organizations } from '@/server/organizations';
import { walletLink } from '@/server/wallet-link';

import { MembersView } from './_components/members-view';

export const metadata: Metadata = { title: 'Members | Zivoe' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** One organization's members and invitations, for its members only: anyone else gets the same 404 as for no organization. */
export default async function MembersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { user } = await verifyOnboarded();

  // The links are only for Delete's warning (the wallets linked to an organization stay linked to it): read beside
  // the page rather than after it, and never shown to someone the page turns away.
  const [page, links] = await Promise.all([
    organizations.getForMember({ organizationId: id, userId: user.id }),
    walletLink.listLinks({ subjectId: id })
  ]);
  if (!page) notFound();

  return <MembersView page={page} viewerId={user.id} hasLinkedWallets={links.length > 0} />;
}
