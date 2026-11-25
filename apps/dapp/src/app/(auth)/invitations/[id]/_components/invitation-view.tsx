'use client';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Link } from '@zivoe/ui/core/link';
import { toast } from '@zivoe/ui/core/sonner';

import { acceptInvitation, declineInvitation } from '@/server/actions/organizations';
import { type InvitationView as View } from '@/server/organizations/organizations';

import { ORGANIZATION_ERROR_COPY } from '@/lib/organization-copy';

import { Auth } from '@/app/(auth)/_components/common';
import { SignOutButton } from '@/app/(auth)/_components/sign-out-button';

/** One card per state of the invitation (`viewForInvitee`); the page redirects `member` before rendering. */
export function InvitationView({
  invitationId,
  view,
  email,
  path
}: {
  invitationId: string;
  view: Exclude<View, { status: 'member' }>;
  /** The address signed in, so someone on the wrong account can tell. */
  email: string;
  path: string;
}) {
  switch (view.status) {
    case 'pending':
      return <PendingInvitation invitationId={invitationId} invitation={view.invitation} email={email} />;
    case 'other_account':
      return (
        <InvitationCard
          title="This invitation is for another account"
          description={
            <p className="text-regular text-secondary">
              It was sent to <span className="break-all text-primary">{view.maskedEmail}</span>. You&apos;re signed in
              as <span className="break-all text-primary">{email}</span>.
            </p>
          }
        >
          <SwitchAccount path={path} />
        </InvitationCard>
      );
    case 'unverified':
      return (
        <InvitationCard
          title="Confirm your email to join"
          description={
            <p className="text-regular text-secondary">
              This invitation is for <span className="break-all text-primary">{email}</span>, which this account
              hasn&apos;t confirmed yet. Sign out, then sign in with a code sent to that address.
            </p>
          }
        >
          <SwitchAccount path={path} />
        </InvitationCard>
      );
    case 'expired':
      return (
        <InvitationCard
          title="This invitation has expired"
          description={`Ask a member of ${view.organizationName} to send it again.`}
        >
          <DashboardLink />
        </InvitationCard>
      );
    case 'invalid':
      return (
        <InvitationCard
          title="This invitation isn't available"
          description="It may have been canceled or already answered. Ask a member of the organization to invite you again."
        >
          <DashboardLink />
        </InvitationCard>
      );
  }
}

function PendingInvitation({
  invitationId,
  invitation,
  email
}: {
  invitationId: string;
  invitation: Extract<View, { status: 'pending' }>['invitation'];
  email: string;
}) {
  const router = useRouter();
  // Thrown, not refused: the request never got an answer.
  const failed = () => toast({ type: 'error', title: ORGANIZATION_ERROR_COPY.failed });

  const accept = useMutation({
    mutationFn: () => acceptInvitation({ invitationId }),
    onSuccess: (result) => {
      // Refused for a reason that says nothing about the invitation: the screen below reads again.
      if (!result.ok) return router.refresh();
      toast({ type: 'success', title: `You joined ${invitation.organizationName}` });
      // Into the organization, among its members. The action dropped the router's copies, so Settings
      // lists the organization, not the invitation.
      router.push(`/settings/organizations/${result.value.organizationId}/members`);
    },
    onError: failed
  });

  const decline = useMutation({
    mutationFn: () => declineInvitation({ invitationId }),
    onSuccess: (result) => {
      if (!result.ok) return router.refresh();
      toast({ type: 'success', title: `You declined the invitation to ${invitation.organizationName}` });
      router.push('/');
    },
    onError: failed
  });

  // Each press clears the other's answer, so the one shown is the latest.
  const answered = accept.data ?? decline.data;
  const refusal = answered && !answered.ok ? ORGANIZATION_ERROR_COPY[answered.error.code] : null;
  // Once one is on its way, the other waits: the page only leaves from here.
  const isBusy = accept.isPending || decline.isPending || !!accept.data?.ok || !!decline.data?.ok;

  return (
    <InvitationCard
      title={`Join ${invitation.organizationName}`}
      description={
        <p className="text-regular text-secondary">
          {invitation.inviterName}
          {invitation.inviterEmail ? (
            <>
              {' '}
              (<span className="break-all">{invitation.inviterEmail}</span>)
            </>
          ) : null}{' '}
          invited you to join <span className="text-primary">{invitation.organizationName}</span> on Zivoe.
        </p>
      }
    >
      {refusal ? (
        <Callout variant="warning" role="alert">
          {refusal}
        </Callout>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button
          variant="primary"
          fullWidth
          onPress={() => {
            decline.reset();
            accept.mutate();
          }}
          isPending={accept.isPending || !!accept.data?.ok}
          isDisabled={isBusy}
          pendingContent="Joining..."
        >
          Accept invitation
        </Button>
        <Button
          variant="border-light"
          fullWidth
          onPress={() => {
            accept.reset();
            decline.mutate();
          }}
          isPending={decline.isPending || !!decline.data?.ok}
          isDisabled={isBusy}
          pendingContent="Declining..."
        >
          Decline
        </Button>
        <p className="text-center text-small text-secondary">
          Signed in as <span className="break-all">{email}</span>
        </p>
      </div>
    </InvitationCard>
  );
}

function InvitationCard({
  title,
  description,
  children
}: {
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <Auth.Container>
        <Auth.Header title={title} description={description} />
        {children}
      </Auth.Container>

      <Auth.HelpFooter />
    </>
  );
}

function DashboardLink() {
  return (
    <Link variant="ghost-light" fullWidth href="/">
      Go to the dashboard
    </Link>
  );
}

/** Signs out and comes back here on the sign-in page, to sign in with the invited address. */
function SwitchAccount({ path }: { path: string }) {
  return (
    <div className="flex flex-col gap-3">
      <SignOutButton variant="primary" next={path}>
        Sign out and switch account
      </SignOutButton>
      <DashboardLink />
    </div>
  );
}
