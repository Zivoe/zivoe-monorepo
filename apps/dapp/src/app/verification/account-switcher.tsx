'use client';

import { useState } from 'react';

import { useRouter } from 'next/navigation';

import * as Aria from 'react-aria-components';

import { Menu, MenuItem, MenuPopover, MenuSection, MenuSeparator, MenuTrigger } from '@zivoe/ui/core/menu';
import { CheckIcon, ChevronDownIcon } from '@zivoe/ui/icons';
import { cn } from '@zivoe/ui/lib/tw-utils';

import { type VerificationStatusView } from '@/server/verification/verification-status';

import { initialsOf } from '@/lib/initials';

import { CreateOrganizationDialog } from '@/components/create-organization-dialog';

import { organizationIdOf, verificationHref } from './verification-href';

/** Someone a person can verify as: themselves (`organization` null), or an organization they belong to. */
export type SubjectOption = {
  id: string;
  name: string;
  view: VerificationStatusView;
  organization: { name: string; countryOfIncorporation: string | null } | null;
};

const CREATE = 'create';

/**
 * "Verifying as", at the top of `/verification`'s rail on every step: who is being verified, and a menu to
 * switch to themselves or another of their organizations, or to create one. Disabled only while a start is
 * in flight; switching away from an open Persona form is like a refresh, and Persona keeps the progress.
 */
export function AccountSwitcher({
  subjects,
  activeId,
  isDisabled
}: {
  subjects: Array<SubjectOption>;
  activeId: string;
  isDisabled: boolean;
}) {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const active = subjects.find((subject) => subject.id === activeId) ?? subjects[0];
  if (!active) return null;

  return (
    <>
      <MenuTrigger>
        <Aria.Button
          isDisabled={isDisabled}
          aria-label={`Verifying as ${active.name}, ${accountLabel(active)}. Switch account`}
          className="flex w-full items-center gap-3 rounded-lg bg-surface-base py-4 pr-3 pl-4 text-left outline-hidden transition-opacity focus-visible:ring-2 focus-visible:ring-default disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Avatar name={active.name} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span title={active.name} className="line-clamp-2 text-regular font-medium break-words text-primary">
              {active.name}
            </span>
            <span className="text-small text-secondary">{accountLabel(active)}</span>
          </span>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated-low-emphasis text-icon-default">
            <ChevronDownIcon aria-hidden="true" className="size-5" />
          </span>
        </Aria.Button>

        <MenuPopover placement="bottom start" className="w-(--trigger-width) min-w-72 rounded-[10px] px-3 pt-5 pb-3">
          <Menu
            aria-label="Switch account"
            scrollAreaClassName="max-h-[min(28rem,70vh)]"
            onAction={(key) => {
              if (key === CREATE) return setIsCreating(true);
              const picked = subjects.find((subject) => subject.id === key);
              if (picked && picked.id !== active.id)
                router.push(verificationHref({ organizationId: organizationIdOf(picked) }));
            }}
          >
            {/* The menu's own `space-y-1` stops at the section, so its rows get their gap here. */}
            <MenuSection className="flex flex-col gap-1">
              <Aria.Header className="pb-1 pl-3 text-small text-secondary">Switch account</Aria.Header>
              {subjects.map((subject) => {
                const isActive = subject.id === active.id;
                return (
                  <MenuItem
                    key={subject.id}
                    id={subject.id}
                    textValue={subject.name}
                    className={cn('gap-3 rounded-lg p-3', isActive && 'bg-surface-elevated-low-emphasis')}
                  >
                    <Avatar name={subject.name} isOnSurface={isActive} />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span
                        title={subject.name}
                        className="line-clamp-2 text-regular font-medium break-words text-primary"
                      >
                        {subject.name}
                      </span>
                      <span className="text-small text-secondary">{subtitle(subject)}</span>
                    </span>
                    {isActive ? (
                      <span
                        role="img"
                        aria-label="Selected"
                        className="flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-brand text-icon-base"
                      >
                        <CheckIcon aria-hidden="true" strokeWidth={1.5} className="size-3.5" />
                      </span>
                    ) : null}
                  </MenuItem>
                );
              })}
            </MenuSection>
            <MenuSeparator className="bg-element-neutral-light" />
            <MenuItem id={CREATE} textValue="Create organization" className="gap-3 rounded-lg p-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-dashed border-default text-regular font-medium text-brand-subtle"
              >
                +
              </span>
              <span className="text-regular font-medium text-brand-subtle">Create organization</span>
            </MenuItem>
          </Menu>
        </MenuPopover>
      </MenuTrigger>

      <CreateOrganizationDialog
        isOpen={isCreating}
        onOpenChange={setIsCreating}
        // Its details were just given: on to verifying it.
        onCreated={(organizationId) => router.push(verificationHref({ organizationId, step: 'identity' }))}
      />
    </>
  );
}

const accountLabel = (subject: SubjectOption) =>
  subject.organization ? 'Organization · KYB' : 'Individual account · KYC';

const subtitle = (subject: SubjectOption) => (subject.organization ? 'Organization account' : 'Individual account');

function Avatar({ name, isOnSurface = false }: { name: string; isOnSurface?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-sm text-regular font-medium text-secondary',
        isOnSurface ? 'bg-surface-base' : 'bg-surface-elevated-low-emphasis'
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
