'use client';

import { useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import * as Aria from 'react-aria-components';

import { Badge } from '@zivoe/ui/core/badge';
import { Button } from '@zivoe/ui/core/button';
import { Link } from '@zivoe/ui/core/link';
import { Menu, MenuItem, MenuPopover, MenuSeparator, MenuTrigger } from '@zivoe/ui/core/menu';
import { Skeleton } from '@zivoe/ui/core/skeleton';
import { CheckIcon, ChevronDownIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { initialsOf } from '@/lib/initials';

import { CreateOrganizationDialog } from '@/components/create-organization-dialog';

type OrganizationEntry = { id: string; name: string };
type InvitationEntry = { id: string; organizationName: string };

const CREATE = 'create';

export const membersPath = (organizationId: string) => `/settings/organizations/${organizationId}/members`;

/**
 * The Settings column: Personal (Notifications), then Organizations: a picker
 * for which one, its Members page, and Create organization, then Invitations, when
 * any are waiting for this person, each a link to its own page (accept, decline,
 * or why it is gone). The picker shows the organization in the URL; on a personal page
 * it shows the first one (joined earliest), so its Members page is a click away
 * there too, and choosing one opens its Members page. Below `lg` the same places fit in two short
 * rows, the picker and then the pages as tabs, so the page itself starts on the first screen.
 */
export function SettingsNavigation({
  organizations,
  invitations
}: {
  organizations: Array<OrganizationEntry>;
  invitations: Array<InvitationEntry>;
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const inUrl = /^\/settings\/organizations\/([^/]+)/.exec(pathname)?.[1];
  const selected = organizations.find((organization) => organization.id === inUrl) ?? organizations[0];

  const open = (organizationId: string) => router.push(membersPath(organizationId));

  return (
    <nav aria-label="Settings" className="w-full shrink-0 lg:w-60">
      {/* Phones and tablets: the picker, then the pages as a row of tabs. */}
      <div className="flex flex-col gap-3 lg:hidden">
        {organizations.length > 0 ? (
          <OrganizationPicker
            organizations={organizations}
            selected={selected}
            onOpen={open}
            onCreate={() => setIsCreating(true)}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-1">
          <NavigationLink href="/settings/notifications" pathname={pathname} isCompact>
            Notifications
          </NavigationLink>
          {selected ? (
            <NavigationLink href={membersPath(selected.id)} pathname={pathname} isCompact>
              Members
            </NavigationLink>
          ) : null}
          {invitations.length > 0 ? <InvitationsMenu invitations={invitations} /> : null}
          {organizations.length === 0 ? (
            <Button variant="border-light" size="m" onPress={() => setIsCreating(true)}>
              <span aria-hidden="true">+</span> Create organization
            </Button>
          ) : null}
        </div>
      </div>

      {/* Desktop: the column. */}
      <div className="hidden flex-col gap-6 lg:flex">
        <NavigationGroup title="Personal">
          <NavigationLink href="/settings/notifications" pathname={pathname}>
            Notifications
          </NavigationLink>
        </NavigationGroup>

        <div aria-hidden="true" className="h-px bg-element-neutral-subtle" />

        <NavigationGroup title="Organizations">
          {organizations.length > 0 ? (
            <>
              <OrganizationPicker
                organizations={organizations}
                selected={selected}
                onOpen={open}
                onCreate={() => setIsCreating(true)}
                className="mb-2"
              />

              {selected ? (
                <NavigationLink href={membersPath(selected.id)} pathname={pathname}>
                  Members
                </NavigationLink>
              ) : null}
            </>
          ) : (
            <Button variant="border-light" size="m" fullWidth onPress={() => setIsCreating(true)}>
              <span aria-hidden="true">+</span> Create organization
            </Button>
          )}
        </NavigationGroup>

        {invitations.length > 0 ? (
          <>
            <div aria-hidden="true" className="h-px bg-element-neutral-subtle" />

            <NavigationGroup title="Invitations">
              <ul aria-label="Invitations waiting for you" className="flex flex-col gap-1">
                {invitations.map((invitation) => (
                  <li key={invitation.id}>
                    <Link
                      href={`/invitations/${invitation.id}`}
                      variant="ghost"
                      size="m"
                      fullWidth
                      className="justify-start gap-2 px-2 font-normal text-primary"
                    >
                      <Initials name={invitation.organizationName} />
                      <span title={invitation.organizationName} className="min-w-0 flex-1 truncate text-left">
                        {invitation.organizationName}
                      </span>
                      <Badge variant="neutral">Invited</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </NavigationGroup>
          </>
        ) : null}
      </div>

      <CreateOrganizationDialog isOpen={isCreating} onOpenChange={setIsCreating} onCreated={open} />
    </nav>
  );
}

/**
 * The column while the person's organizations and invitations are on their way: what everyone has
 * (Notifications), and a block where the organization picker or Create organization goes.
 */
export function SettingsNavigationSkeleton() {
  const pathname = usePathname() ?? '';

  return (
    <nav aria-label="Settings" className="w-full shrink-0 lg:w-60">
      <div className="flex flex-wrap items-center gap-1 lg:hidden">
        <NavigationLink href="/settings/notifications" pathname={pathname} isCompact>
          Notifications
        </NavigationLink>
        <Skeleton className="h-10 w-44 rounded-sm" />
      </div>

      <div className="hidden flex-col gap-6 lg:flex">
        <NavigationGroup title="Personal">
          <NavigationLink href="/settings/notifications" pathname={pathname}>
            Notifications
          </NavigationLink>
        </NavigationGroup>

        <div aria-hidden="true" className="h-px bg-element-neutral-subtle" />

        <NavigationGroup title="Organizations">
          <Skeleton className="h-10 w-full rounded-sm" />
        </NavigationGroup>
      </div>
    </nav>
  );
}

/** Which organization's settings: its Members page opens on a choice, or the create dialog. */
function OrganizationPicker({
  organizations,
  selected,
  onOpen,
  onCreate,
  className
}: {
  organizations: Array<OrganizationEntry>;
  selected: OrganizationEntry | undefined;
  onOpen: (organizationId: string) => void;
  onCreate: () => void;
  className?: string;
}) {
  return (
    <MenuTrigger>
      <Aria.Button
        aria-label={selected ? `Organization: ${selected.name}. Switch organization` : 'Select an organization'}
        className={cn(
          'flex h-11 w-full items-center gap-2 rounded-lg border border-subtle bg-surface-base px-2 text-left outline-hidden hover:bg-element-neutral-light focus-visible:ring-2 focus-visible:ring-default',
          className
        )}
      >
        {selected ? (
          <>
            <Initials name={selected.name} />
            <span title={selected.name} className="min-w-0 flex-1 truncate text-small font-medium text-primary">
              {selected.name}
            </span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate pl-1 text-small text-tertiary">Select an organization</span>
        )}
        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-icon-default" />
      </Aria.Button>
      <MenuPopover placement="bottom start" className="w-(--trigger-width) min-w-60">
        {/* Scrolls within the popover past a few organizations, as the Verifying-as switcher does. */}
        <Menu
          aria-label="Your organizations"
          scrollAreaClassName="max-h-[min(24rem,60vh)]"
          onAction={(key) => (key === CREATE ? onCreate() : onOpen(String(key)))}
        >
          {organizations.map((organization) => (
            <MenuItem key={organization.id} id={organization.id} textValue={organization.name}>
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Initials name={organization.name} />
                <span title={organization.name} className="min-w-0 flex-1 truncate font-medium text-primary">
                  {organization.name}
                </span>
                {organization.id === selected?.id ? (
                  <CheckIcon aria-label="Selected" className="size-4 shrink-0 text-brand-subtle" />
                ) : null}
              </span>
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem id={CREATE} textValue="Create organization">
            <span className="font-medium text-brand-subtle">+ Create organization</span>
          </MenuItem>
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}

/** Below `lg`, the invitations waiting for this person as one tab: a menu of links to each invitation's page. */
function InvitationsMenu({ invitations }: { invitations: Array<InvitationEntry> }) {
  return (
    <MenuTrigger>
      <Aria.Button
        aria-label={`Invitations waiting for you: ${invitations.length}`}
        className="flex h-10 items-center gap-2 rounded-lg border border-transparent px-3 text-regular text-primary outline-hidden hover:bg-element-neutral-light focus-visible:ring-2 focus-visible:ring-default"
      >
        Invitations
        <Badge variant="neutral">{invitations.length}</Badge>
      </Aria.Button>
      <MenuPopover placement="bottom start" className="w-72 max-w-[calc(100vw-2rem)]">
        <Menu aria-label="Invitations waiting for you" scrollAreaClassName="max-h-[min(24rem,60vh)]">
          {invitations.map((invitation) => (
            <MenuItem
              key={invitation.id}
              id={invitation.id}
              href={`/invitations/${invitation.id}`}
              textValue={invitation.organizationName}
            >
              <span className="flex min-w-0 flex-1 items-center gap-3">
                <Initials name={invitation.organizationName} />
                <span title={invitation.organizationName} className="min-w-0 flex-1 truncate text-primary">
                  {invitation.organizationName}
                </span>
              </span>
            </MenuItem>
          ))}
        </Menu>
      </MenuPopover>
    </MenuTrigger>
  );
}

function NavigationGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="mb-2 font-paragraph! text-regular font-semibold text-primary">{title}</h2>
      {children}
    </div>
  );
}

function NavigationLink({
  href,
  pathname,
  isCompact = false,
  children
}: {
  href: string;
  pathname: string;
  /** A tab in the row below `lg`, as wide as its label; otherwise a full-width row of the column. */
  isCompact?: boolean;
  children: string;
}) {
  const isCurrent = pathname === href;
  return (
    <Link
      href={href}
      variant="ghost"
      size="m"
      fullWidth={!isCompact}
      aria-current={isCurrent ? 'page' : undefined}
      // The current page: a white card on the grey page, with the portfolio cards' edge and shadow, and a
      // medium weight that sets it apart from the organization picker above it. The transparent border keeps
      // the item the same size when it becomes current.
      className="justify-start rounded-lg border border-transparent font-normal text-primary current:border-subtle current:bg-surface-base current:font-medium current:shadow-[0px_1px_2px_rgba(16,24,40,0.04),0px_4px_12px_-4px_rgba(16,24,40,0.06)]"
    >
      {children}
    </Link>
  );
}

function Initials({ name }: { name: string }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-xs bg-surface-elevated-low-emphasis text-extraSmall font-medium text-secondary"
    >
      {initialsOf(name)}
    </span>
  );
}
