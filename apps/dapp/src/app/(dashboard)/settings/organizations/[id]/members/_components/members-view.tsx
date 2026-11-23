'use client';

import { useEffect, useRef, useState } from 'react';

import { useRouter } from 'next/navigation';

import { useMutation } from '@tanstack/react-query';

import { Badge } from '@zivoe/ui/core/badge';
import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@zivoe/ui/core/card';
import { DialogContent, DialogContentBox, DialogFooter, DialogHeader, DialogTitle } from '@zivoe/ui/core/dialog';
import { Menu, MenuItem, MenuPopover, MenuTrigger } from '@zivoe/ui/core/menu';
import { toast } from '@zivoe/ui/core/sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
  TableRowHeader
} from '@zivoe/ui/core/table';
import { ArrowLeftIcon, ArrowRightIcon, EmailIcon } from '@zivoe/ui/icons';

import {
  type OrganizationActionResult,
  cancelInvitation,
  deleteOrganization,
  leaveOrganization,
  removeMember,
  resendInvitation
} from '@/server/actions/organizations';
import { MAX_INVITATION_SENDS } from '@/server/organizations/organization-limits';
import { type OrganizationPage } from '@/server/organizations/organizations';

import { initialsOf } from '@/lib/initials';
import { ORGANIZATION_ERROR_COPY } from '@/lib/organization-copy';
import { invitationLinkPath } from '@/lib/return-paths';

import { InviteTeamForm } from '@/components/invite-team-form';

// ---------------------------------------------------------------------------
// Settings → Organizations → Members: who is in the organization and who has
// been asked, one list, ten to a page. Members come first, oldest first, then
// invitations, newest first. Above `@2xl` it is a table; below, a list.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 10;

type Row = {
  id: string;
  kind: 'member' | 'invitation';
  name: string;
  email: string;
  status: 'Active' | 'Invited' | 'Expired';
  /** The member's account; null for an invitation. */
  userId: string | null;
  isViewer: boolean;
  /** Resend is offered until the third send; inside the minute after one, the server says so. */
  canResend: boolean;
};

const STATUS_BADGES = { Active: 'primary', Invited: 'neutral', Expired: 'warning' } as const;

function toRows(page: OrganizationPage, viewerId: string): Array<Row> {
  const now = Date.now();
  return [
    ...page.members.map(
      (member): Row => ({
        id: member.id,
        kind: 'member',
        name: member.name,
        email: member.email,
        status: 'Active',
        userId: member.userId,
        isViewer: member.userId === viewerId,
        canResend: false
      })
    ),
    ...page.invitations.map(
      (invitation): Row => ({
        id: invitation.id,
        kind: 'invitation',
        name: invitation.email,
        email: invitation.email,
        status: new Date(invitation.expiresAt).getTime() > now ? 'Invited' : 'Expired',
        userId: null,
        isViewer: false,
        // A minute after the last one it may go again; sooner, the server says so.
        canResend: invitation.sendCount < MAX_INVITATION_SENDS
      })
    )
  ];
}

export function MembersView({
  page,
  viewerId,
  hasLinkedWallets
}: {
  page: OrganizationPage;
  viewerId: string;
  hasLinkedWallets: boolean;
}) {
  const router = useRouter();
  const [isInviting, setIsInviting] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);

  const rows = toRows(page, viewerId);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // A cancelled invitation can empty the last page: stay on the last one there is.
  const current = Math.min(pageIndex, pageCount - 1);
  const shown = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);
  const isLastMember = page.members.length === 1;
  const refresh = () => router.refresh();

  // A row that goes (cancelled, removed), or a page button that turns disabled on the first or last page,
  // takes the focus with it, to the page's top: it comes back to the card's title instead, so a keyboard
  // carries on from here. Not on the first render.
  const titleRef = useRef<HTMLHeadingElement>(null);
  const rendered = useRef(false);
  const rowIds = shown.map((row) => row.id).join();
  useEffect(() => {
    if (rendered.current && document.activeElement === document.body) titleRef.current?.focus();
    rendered.current = true;
  }, [rowIds]);

  const actions = (row: Row) => (
    <RowActions
      row={row}
      organizationId={page.id}
      organizationName={page.name}
      isLastMember={isLastMember}
      hasLinkedWallets={hasLinkedWallets}
      onChanged={refresh}
    />
  );

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle ref={titleRef} tabIndex={-1} className="outline-none">
              Members
            </CardTitle>
            <p className="text-small break-words text-secondary">{page.name}</p>
          </div>
          <Button size="m" onPress={() => setIsInviting(true)}>
            Invite member
          </Button>
        </CardHeader>

        <CardContent className="gap-6">
          <div className="@container">
            <TableContainer aria-label={`${page.name} members`} className="hidden @2xl:block">
              <Table>
                <TableHead>
                  <TableRow>
                    {/* The outer columns drop their side padding, so the table lines up with the card's
                        title and button, as the portfolio's Tokens card does. */}
                    <TableHeaderCell className="pl-0">Member</TableHeaderCell>
                    <TableHeaderCell>Status</TableHeaderCell>
                    <TableHeaderCell className="pr-0 text-right">
                      <span className="sr-only">Actions</span>
                    </TableHeaderCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {shown.map((row) => (
                    <TableRow key={row.id}>
                      <TableRowHeader className="pl-0">
                        <Person row={row} />
                      </TableRowHeader>
                      <TableCell>
                        <Badge variant={STATUS_BADGES[row.status]}>{row.status}</Badge>
                      </TableCell>
                      <TableCell className="pr-0 text-right">{actions(row)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <ul aria-label={`${page.name} members`} className="flex flex-col divide-y divide-subtle @2xl:hidden">
              {shown.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="flex min-w-0 flex-col gap-2">
                    <Person row={row} />
                    <Badge variant={STATUS_BADGES[row.status]} className="self-start">
                      {row.status}
                    </Badge>
                  </div>
                  {actions(row)}
                </li>
              ))}
            </ul>
          </div>

          {/* Only with more than one page: "Showing 1–2 of 2" says nothing the list doesn't. */}
          {pageCount > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-small text-secondary">
                Showing {current * PAGE_SIZE + 1}–{current * PAGE_SIZE + shown.length} of {rows.length}
              </p>
              <nav aria-label="Members pages" className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="s"
                  aria-label="Previous page"
                  isDisabled={current === 0}
                  onPress={() => setPageIndex(current - 1)}
                >
                  <ArrowLeftIcon aria-hidden="true" />
                </Button>
                <span className="text-regular text-primary">
                  {current + 1} <span className="text-secondary">of {pageCount}</span>
                </span>
                <Button
                  variant="ghost"
                  size="s"
                  aria-label="Next page"
                  isDisabled={current === pageCount - 1}
                  onPress={() => setPageIndex(current + 1)}
                >
                  <ArrowRightIcon aria-hidden="true" />
                </Button>
              </nav>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Closed with some addresses refused, the ones that went out still belong in the table. */}
      <DialogContent
        isOpen={isInviting}
        onOpenChange={(isOpen) => {
          setIsInviting(isOpen);
          if (!isOpen) refresh();
        }}
        aria-label="Invite members"
      >
        <DialogContentBox>
          <DialogHeader className="p-0 pr-12">
            <DialogTitle>Invite members to {page.name}</DialogTitle>
          </DialogHeader>
          <p className="text-regular text-secondary">
            They get an email with a link to join {page.name}. The link expires in 7 days.
          </p>
          <InviteTeamForm
            organizationId={page.id}
            submitLabel="Send invitations"
            autoFocus
            onDone={() => {
              setIsInviting(false);
              refresh();
            }}
          />
        </DialogContentBox>
      </DialogContent>
    </>
  );
}

function Person({ row }: { row: Row }) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-elevated text-small font-medium text-secondary"
      >
        {/* An invitation has only an address: an envelope until they join and have a name. */}
        {row.kind === 'member' ? initialsOf(row.name) : <EmailIcon className="size-4 text-icon-default" />}
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="font-normal wrap-anywhere text-primary">
          {row.name}
          {row.isViewer ? <span className="text-secondary"> (You)</span> : null}
        </span>
        {row.kind === 'member' ? <span className="text-small break-all text-secondary">{row.email}</span> : null}
      </span>
    </span>
  );
}

type Confirming = 'cancel' | 'leave' | 'delete' | 'remove' | null;

/**
 * The ⋯ menu: Resend and Cancel on an invitation; on the viewer's own row, Leave, or Delete for the
 * last member; on another member's row, Remove (there are no roles: any member may remove another).
 * Everything but Resend and Copy invite link asks first.
 */
function RowActions({
  row,
  organizationId,
  organizationName,
  isLastMember,
  hasLinkedWallets,
  onChanged
}: {
  row: Row;
  organizationId: string;
  organizationName: string;
  isLastMember: boolean;
  hasLinkedWallets: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<Confirming>(null);
  // What the dialog says, kept while it fades out after `confirming` clears, so it never reads as another.
  const [asked, setAsked] = useState<NonNullable<Confirming>>('leave');
  const ask = (action: NonNullable<Confirming>) => {
    setAsked(action);
    setConfirming(action);
  };

  const run = useMutation({
    mutationFn: async (
      action: 'resend' | 'cancel' | 'leave' | 'delete' | 'remove'
    ): Promise<OrganizationActionResult> => {
      switch (action) {
        case 'resend':
          return resendInvitation({ invitationId: row.id });
        case 'cancel':
          return cancelInvitation({ invitationId: row.id });
        case 'leave':
          return leaveOrganization({ organizationId });
        case 'delete':
          return deleteOrganization({ organizationId });
        case 'remove':
          return removeMember({ organizationId, userId: row.userId ?? '' });
      }
    },
    onSuccess: (result, action) => {
      // Answered either way: a refusal's toast says why, and the list below is read again.
      setConfirming(null);
      if (!result.ok) {
        toast({ type: 'error', title: ORGANIZATION_ERROR_COPY[result.error.code] });
        onChanged();
        return;
      }
      if (action === 'leave' || action === 'delete') {
        toast({
          type: 'success',
          title: action === 'leave' ? `You left ${organizationName}` : `${organizationName} deleted`
        });
        // The action dropped the router's copies, so the Settings column no longer lists it.
        router.push('/settings/notifications');
        return;
      }
      const done = {
        resend: `Invitation sent again to ${row.email}`,
        cancel: `Invitation to ${row.email} canceled`,
        remove: `${row.name} removed from ${organizationName}`
      };
      toast({ type: 'success', title: done[action] });
      onChanged();
    },
    onError: () => toast({ type: 'error', title: ORGANIZATION_ERROR_COPY.failed })
  });

  // Only the invited address's owner can use the link, so it can go out another way (a chat, when the
  // email sits in spam) without letting anyone else in. It prefills their address on sign-in, as the email's does.
  const copyLink = () => {
    // Inside the promise: a page served without HTTPS has no clipboard, and that reads as a failure too.
    Promise.resolve()
      .then(() =>
        navigator.clipboard.writeText(
          `${window.location.origin}${invitationLinkPath({ invitationId: row.id, email: row.email })}`
        )
      )
      .then(
        () => toast({ type: 'success', title: 'Invite link copied' }),
        () => toast({ type: 'error', title: "Couldn't copy the link. Please try again." })
      );
  };

  const confirm = {
    cancel: {
      title: `Cancel the invitation to ${row.email}?`,
      body: 'Its link stops working at once. You can invite them again later.',
      action: 'Cancel invitation',
      pending: 'Canceling...'
    },
    leave: {
      title: `Leave ${organizationName}?`,
      body: "You'll lose access to this organization, and invitations you sent that are still waiting are canceled.",
      action: 'Leave organization',
      pending: 'Leaving...'
    },
    delete: {
      title: `Delete ${organizationName}?`,
      body: `This permanently deletes ${organizationName}. This can't be undone.`,
      action: 'Delete organization',
      pending: 'Deleting...'
    },
    remove: {
      title: `Remove ${row.name}?`,
      body: `They'll lose access to ${organizationName}, and we'll email them to let them know. Invitations they sent that are still waiting are canceled.`,
      action: 'Remove member',
      pending: 'Removing...'
    }
  }[asked];

  return (
    <>
      <MenuTrigger>
        {/* The ring sits inside the button: at the table's edge, the scroll box would clip one drawn outside. */}
        <Button
          variant="ghost-light"
          size="s"
          aria-label={`Actions for ${row.name}`}
          className="focus-visible:ring-offset-0 focus-visible:ring-inset"
        >
          <span aria-hidden="true" className="text-leading leading-none">
            ⋯
          </span>
        </Button>
        <MenuPopover placement="bottom end">
          <Menu
            aria-label={`Actions for ${row.name}`}
            onAction={(key) => {
              // The trigger stays enabled, so focus can come back to it from the menu; a second action waits here.
              if (run.isPending) return;
              if (key === 'resend') run.mutate(key);
              if (key === 'copy') copyLink();
              if (key === 'cancel' || key === 'leave' || key === 'delete' || key === 'remove') ask(key);
            }}
          >
            {row.kind === 'invitation' && row.canResend ? <MenuItem id="resend">Resend</MenuItem> : null}
            {row.status === 'Invited' ? <MenuItem id="copy">Copy invite link</MenuItem> : null}
            {row.kind === 'invitation' ? <MenuItem id="cancel">Cancel invitation</MenuItem> : null}
            {row.isViewer && !isLastMember ? <MenuItem id="leave">Leave organization</MenuItem> : null}
            {row.isViewer && isLastMember ? <MenuItem id="delete">Delete organization</MenuItem> : null}
            {row.kind === 'member' && !row.isViewer ? <MenuItem id="remove">Remove from organization</MenuItem> : null}
          </Menu>
        </MenuPopover>
      </MenuTrigger>

      <DialogContent
        isOpen={confirming !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setConfirming(null);
        }}
        aria-label={confirm.action}
      >
        <DialogContentBox>
          <DialogHeader className="p-0 pr-12">
            <DialogTitle>{confirm.title}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3 text-regular text-secondary">
            <p>{confirm.body}</p>
            {asked === 'delete' && hasLinkedWallets ? (
              <Callout variant="warning">
                The wallets linked to this organization stay linked to it, so those addresses can never be linked to
                another account. Their whitelist will be revoked.
              </Callout>
            ) : null}
          </div>

          <DialogFooter>
            {/* The safe answer first: Enter on an opened dialog keeps everything as it is. */}
            <Button autoFocus variant="ghost-light" onPress={() => setConfirming(null)} isDisabled={run.isPending}>
              {asked === 'cancel' ? 'Keep' : 'Cancel'}
            </Button>
            <Button
              variant="primary"
              onPress={() => confirming && run.mutate(confirming)}
              isPending={run.isPending}
              pendingContent={confirm.pending}
            >
              {confirm.action}
            </Button>
          </DialogFooter>
        </DialogContentBox>
      </DialogContent>
    </>
  );
}
