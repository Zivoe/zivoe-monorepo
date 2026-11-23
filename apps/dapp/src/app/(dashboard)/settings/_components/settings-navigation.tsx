'use client';

import { useState } from 'react';

import { usePathname, useRouter } from 'next/navigation';

import * as Aria from 'react-aria-components';

import { Badge } from '@zivoe/ui/core/badge';
import { Button } from '@zivoe/ui/core/button';
import { Link } from '@zivoe/ui/core/link';
import { Menu, MenuItem, MenuPopover, MenuSeparator, MenuTrigger } from '@zivoe/ui/core/menu';
import { CheckIcon, ChevronDownIcon } from '@zivoe/ui/icons';

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
 * it shows none, so nothing reads as being in an organization's settings, and
 * choosing one opens its Members page.
 */
export function SettingsNavigation({
  showOrganizations,
  organizations,
  invitations
}: {
  showOrganizations: boolean;
  organizations: Array<OrganizationEntry>;
  invitations: Array<InvitationEntry>;
}) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  const inUrl = /^\/settings\/organizations\/([^/]+)/.exec(pathname)?.[1];
  const selected = organizations.find((organization) => organization.id === inUrl);

  const open = (organizationId: string) => router.push(membersPath(organizationId));

  return (
    <nav aria-label="Settings" className="flex w-full shrink-0 flex-col gap-6 lg:w-60">
      <NavigationGroup title="Personal">
        <NavigationLink href="/settings/notifications" pathname={pathname}>
          Notifications
        </NavigationLink>
      </NavigationGroup>

      {showOrganizations ? (
        <>
          <div aria-hidden="true" className="h-px bg-element-neutral-subtle" />

          <NavigationGroup title="Organizations">
            {organizations.length > 0 ? (
              <>
                <MenuTrigger>
                  <Aria.Button
                    aria-label={
                      selected ? `Organization: ${selected.name}. Switch organization` : 'Select an organization'
                    }
                    className="mb-2 flex h-11 w-full items-center gap-2 rounded-lg border border-subtle bg-surface-base px-2 text-left outline-hidden hover:bg-element-neutral-light focus-visible:ring-2 focus-visible:ring-default"
                  >
                    {selected ? (
                      <>
                        <Initials name={selected.name} />
                        <span
                          title={selected.name}
                          className="min-w-0 flex-1 truncate text-small font-medium text-primary"
                        >
                          {selected.name}
                        </span>
                      </>
                    ) : (
                      <span className="min-w-0 flex-1 truncate pl-1 text-small text-tertiary">
                        Select an organization
                      </span>
                    )}
                    <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 text-icon-default" />
                  </Aria.Button>
                  <MenuPopover placement="bottom start" className="w-(--trigger-width) min-w-60">
                    {/* Scrolls within the popover past a few organizations, as the Verifying-as switcher does. */}
                    <Menu
                      aria-label="Your organizations"
                      scrollAreaClassName="max-h-[min(24rem,60vh)]"
                      onAction={(key) => (key === CREATE ? setIsCreating(true) : open(String(key)))}
                    >
                      {organizations.map((organization) => (
                        <MenuItem key={organization.id} id={organization.id} textValue={organization.name}>
                          <span className="flex min-w-0 flex-1 items-center gap-3">
                            <Initials name={organization.name} />
                            <span
                              title={organization.name}
                              className="min-w-0 flex-1 truncate font-medium text-primary"
                            >
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

          <CreateOrganizationDialog isOpen={isCreating} onOpenChange={setIsCreating} onCreated={open} />
        </>
      ) : null}
    </nav>
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

function NavigationLink({ href, pathname, children }: { href: string; pathname: string; children: string }) {
  const isCurrent = pathname === href;
  return (
    <Link
      href={href}
      variant="ghost"
      size="m"
      fullWidth
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
