'use client';

import { type ReactNode, useEffect, useRef, useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import * as Aria from 'react-aria-components';

import { Button } from '@zivoe/ui/core/button';
import { Callout } from '@zivoe/ui/core/callout';
import { Input } from '@zivoe/ui/core/input';
import { toast } from '@zivoe/ui/core/sonner';
import { CloseIcon } from '@zivoe/ui/icons';

import { inviteMembers } from '@/server/actions/organizations';

import { ORGANIZATION_ERROR_COPY } from '@/lib/organization-copy';
import { MAX_INVITATIONS_AT_ONCE, invitationEmailSchema } from '@/lib/schemas/organizations';

type Row = { key: number; email: string; error: string | null };

/**
 * Invites colleagues, one address per field: onboarding's "Will anyone else be joining you?" step and the
 * members page's invite dialog. Each address gets its own answer: the ones sent leave the list, the ones
 * refused stay with the reason under them. `onDone` runs once every address has gone out; `children` sits
 * under the submit button (onboarding's "Skip for now"). `autoFocus` puts the cursor in the first field
 * when the form appears, for the dialog, which otherwise focuses itself.
 */
export function InviteTeamForm({
  organizationId,
  submitLabel,
  onDone,
  autoFocus = false,
  children
}: {
  organizationId: string;
  submitLabel: string;
  onDone: () => void;
  autoFocus?: boolean;
  children?: ReactNode;
}) {
  const nextKey = useRef(1);
  const [rows, setRows] = useState<Array<Row>>([{ key: 0, email: '', error: null }]);
  const [problem, setProblem] = useState<string | null>(null);
  // The field to focus after a render: a new one, the first refused, or the one before a removed field.
  const inputs = useRef(new Map<number, HTMLInputElement>());
  const [focusKey, setFocusKey] = useState<number | null>(null);
  useEffect(() => {
    if (focusKey === null) return;
    inputs.current.get(focusKey)?.focus();
    setFocusKey(null);
  }, [focusKey]);

  const filled = rows.filter((row) => row.email.trim() !== '');

  const invite = useMutation({
    mutationFn: (emails: Array<string>) => inviteMembers({ organizationId, emails }),
    onSuccess: (result) => {
      if (!result.ok) return setProblem(ORGANIZATION_ERROR_COPY[result.error.code]);

      const refused = new Map(
        result.value.results.flatMap(
          (row): Array<[string, string]> => (row.error ? [[row.email, ORGANIZATION_ERROR_COPY[row.error]]] : [])
        )
      );
      const sent = result.value.results.filter((row) => !row.error);
      if (sent.length > 0) {
        toast({
          type: 'success',
          title: sent.length === 1 ? `Invitation sent to ${sent[0]?.email}` : `${sent.length} invitations sent`
        });
      }
      if (refused.size === 0) return onDone();

      // The server answers by the normalized address; the refused ones stay, each with its reason.
      const left = [...refused].map(([email, error]) => ({ key: nextKey.current++, email, error }));
      setRows(left);
      setFocusKey(left[0]?.key ?? null);
    },
    onError: () => setProblem(ORGANIZATION_ERROR_COPY.failed)
  });

  const submit = () => {
    setProblem(null);
    const checked = rows.map((row) => {
      if (row.email.trim() === '') return { ...row, error: null };
      const parsed = invitationEmailSchema.safeParse(row.email);
      return {
        ...row,
        error: parsed.success ? null : (parsed.error.issues[0]?.message ?? 'Enter a valid email address')
      };
    });
    setRows(checked);
    const firstInvalid = checked.find((row) => row.error);
    if (firstInvalid) return setFocusKey(firstInvalid.key);

    const emails = [...new Set(filled.map((row) => invitationEmailSchema.parse(row.email)))];
    invite.mutate(emails);
  };

  const update = (key: number, email: string) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, email, error: null } : row)));
  const remove = (key: number) => {
    const index = rows.findIndex((row) => row.key === key);
    const rest = rows.filter((row) => row.key !== key);
    setRows(rest);
    setFocusKey(rest[Math.max(0, index - 1)]?.key ?? null);
  };
  const add = () => {
    const key = nextKey.current++;
    setRows((current) => [...current, { key, email: '', error: null }]);
    setFocusKey(key);
  };

  return (
    // `noValidate`: the fields are type="email", and the browser's own bubble would stop the submit before each
    // field could show its own reason.
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-9"
    >
      <div className="flex flex-col gap-4">
        {problem ? (
          <Callout variant="warning" role="alert">
            {problem}
          </Callout>
        ) : null}

        {rows.map((row, index) => (
          <Input
            key={row.key}
            ref={(node) => {
              if (node) inputs.current.set(row.key, node);
              else inputs.current.delete(row.key);
            }}
            aria-label={`Email address ${index + 1}`}
            autoFocus={autoFocus && index === 0}
            type="email"
            placeholder="colleague@company.com"
            autoComplete="off"
            value={row.email}
            onChange={(email) => update(row.key, email)}
            isInvalid={!!row.error}
            errorMessage={row.error ?? undefined}
            isDisabled={invite.isPending}
            endContent={
              rows.length > 1 ? (
                <Aria.Button
                  aria-label={`Remove email address ${index + 1}`}
                  onPress={() => remove(row.key)}
                  isDisabled={invite.isPending}
                  className="flex shrink-0 items-center justify-center rounded-xs text-icon-default outline-hidden hover:text-primary focus-visible:ring-2 focus-visible:ring-default [&_svg]:size-5"
                >
                  <CloseIcon aria-hidden="true" />
                </Aria.Button>
              ) : null
            }
          />
        ))}

        {rows.length < MAX_INVITATIONS_AT_ONCE ? (
          <Button
            variant="link-primary"
            onPress={add}
            isDisabled={invite.isPending}
            // The label carries its own underline; the link hover would draw a second one, and one under the +.
            // Hover deepens the colour instead.
            className="gap-1 self-start text-small font-medium transition-colors hover:text-brand hover:no-underline"
          >
            <span aria-hidden="true">+</span>
            <span className="underline underline-offset-4">Add email</span>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          fullWidth
          isDisabled={filled.length === 0}
          isPending={invite.isPending}
          pendingContent="Sending..."
        >
          {submitLabel}
        </Button>
        {children}
      </div>
    </form>
  );
}
